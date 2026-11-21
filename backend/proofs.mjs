import { Router } from 'express';
import { asyncRoute, requireValue, token } from './security.mjs';
import { rows } from './database.mjs';

export function decodeProof(data) {
  requireValue(typeof data === 'string' && data.length <= 2800000, 'PROOF_TOO_LARGE', 413);
  const match = data.match(/^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/); requireValue(match, 'PROOF_TYPE_INVALID');
  const bytes = Buffer.from(match[2], 'base64'); requireValue(bytes.length > 0 && bytes.length <= 2000000, 'PROOF_TOO_LARGE', 413);
  const valid = match[1] === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : match[1] === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  requireValue(valid, 'PROOF_CONTENT_INVALID'); return { mime: match[1], bytes };
}
export function proofs(pool, auth) {
  const router = Router(); router.use(auth.required);
  router.post('/', auth.role('mahasiswa'), asyncRoute(async (req, res) => {
    const { mime, bytes } = decodeProof(req.body.dataUrl), id = token();
    await rows(pool, 'INSERT INTO leave_proofs (id,owner_user_id,mime_type,content) VALUES (?,?,?,?)', [id, req.user.id, mime, bytes]);
    res.status(201).json({ data: { id } });
  }));
  router.get('/:id', asyncRoute(async (req, res) => {
    const [file] = await rows(pool, `SELECT p.* FROM leave_proofs p JOIN users owner ON owner.id=p.owner_user_id WHERE p.id=? AND owner.is_demo=? AND (p.owner_user_id=? OR ?='admin' OR EXISTS (
      SELECT 1 FROM leave_requests l JOIN leave_recipients r ON r.leave_id=l.id WHERE l.proof_id=p.id AND l.archive_marker IS NULL AND r.lecturer_id=?))`, [req.params.id, Number(req.user.demoScope), req.user.id, req.user.role, req.user.id]);
    requireValue(file, 'NOT_FOUND', 404);
    res.setHeader('Content-Type', file.mime_type); res.setHeader('Content-Disposition', `attachment; filename="bukti.${file.mime_type === 'application/pdf' ? 'pdf' : file.mime_type === 'image/png' ? 'png' : 'jpg'}"`); res.send(file.content);
  }));
  return router;
}
