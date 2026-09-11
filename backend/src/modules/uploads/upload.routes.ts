import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { requireAuth, type AuthenticatedRequest } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { ValidationError } from '../../common/errors';
import { uploadService, type UploadFolder } from './upload.service';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // A thumbnail, not a hero image.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ValidationError('Only PNG, JPEG, WEBP or GIF images are allowed'));
      return;
    }
    cb(null, true);
  },
});

// ADMIN + MANAGER: same offer-editing authority as the rest of the Offers module —
// this endpoint has no capability beyond "upload an image and get a URL back".
export const uploadRoutes = Router();

uploadRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

// Both upload endpoints differ only in which bucket folder they write to, so they
// share one handler rather than two near-identical copies of the multer plumbing.
function handleUpload(folder: UploadFolder): RequestHandler {
  return (req, res, next) => {
    // Wrapped manually (rather than as router-level middleware) so a MulterError —
    // e.g. LIMIT_FILE_SIZE — becomes the same JSON error shape as every other
    // validation failure instead of falling through to the generic 500 branch.
    upload.single('image')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          next(new ValidationError(`Image must be ${MAX_FILE_BYTES / (1024 * 1024)}MB or smaller`));
          return;
        }
        next(err);
        return;
      }
      void (async () => {
        try {
          const file = (req as AuthenticatedRequest).file;
          if (!file) {
            throw new ValidationError('No image file provided (field name: image)');
          }
          res.json({ url: await uploadService.uploadImage(folder, file) });
        } catch (e) {
          next(e);
        }
      })();
    });
  };
}

uploadRoutes.post('/offer-thumbnail', handleUpload('offerThumbnail'));
uploadRoutes.post('/news-image', handleUpload('newsImage'));
uploadRoutes.post('/manager-avatar', handleUpload('managerAvatar'));
