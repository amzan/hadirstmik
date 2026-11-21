import { rows, transaction, audit } from './database.mjs';
import { token, digest, equal, password, hashPassword, requireValue } from './security.mjs';

export async function issueAdminActivation(pool) {
  const raw=token();
  return transaction(pool,async db=>{
    const admins=await rows(db,"SELECT id FROM users WHERE role='admin' AND is_active=1 ORDER BY id LIMIT 2 FOR UPDATE");
    requireValue(admins.length===1,'ADMIN_SELECTION_REQUIRED',409);
    const userId=admins[0].id;
    requireValue(!(await rows(db,'SELECT user_id FROM user_credentials WHERE user_id=?',[userId])).length,'ADMIN_ALREADY_ACTIVATED',409);
    await rows(db,'UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL',[userId]);
    const result=await rows(db,'INSERT INTO password_reset_tokens (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE))',[userId,digest(raw)]);
    await audit(db,userId,'ADMIN_ACTIVATION_ISSUED','user',userId);
    return {id:result.insertId,userId,token:raw};
  });
}
export async function completeAdminActivation(pool,{id,userId,token:raw,newPassword}) {
  password(newPassword);
  requireValue(typeof raw==='string'&&/^[A-Za-z0-9_-]{43}$/.test(raw),'ACTIVATION_INVALID',400);
  const encoded=await hashPassword(newPassword);
  const result=await transaction(pool,async db=>{
    const [user]=await rows(db,"SELECT id,username FROM users WHERE id=? AND role='admin' AND is_active=1 FOR UPDATE",[userId]);
    const [challenge]=await rows(db,'SELECT *,expires_at>UTC_TIMESTAMP() AS valid_time FROM password_reset_tokens WHERE id=? AND user_id=? FOR UPDATE',[id,userId]);
    if(!user||!challenge||challenge.used_at||!challenge.valid_time||challenge.attempts>=5)return null;
    await rows(db,'UPDATE password_reset_tokens SET attempts=attempts+1 WHERE id=?',[id]);
    if(!equal(challenge.token_hash,digest(raw)))return null;
    requireValue(!(await rows(db,'SELECT user_id FROM user_credentials WHERE user_id=?',[userId])).length,'ADMIN_ALREADY_ACTIVATED',409);
    await rows(db,'INSERT INTO user_credentials (user_id,password_hash) VALUES (?,?)',[userId,encoded]);
    await rows(db,'UPDATE password_reset_tokens SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL',[userId]);
    await rows(db,'UPDATE auth_challenges SET used_at=UTC_TIMESTAMP() WHERE user_id=? AND used_at IS NULL',[userId]);
    await rows(db,"UPDATE device_sessions SET status='TERMINATED',revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND status='ACTIVE'",[userId]);
    await audit(db,userId,'ADMIN_ACTIVATED','user',userId);
    return {userId,username:user.username};
  });
  requireValue(result,'ACTIVATION_INVALID',400);
  return result;
}
