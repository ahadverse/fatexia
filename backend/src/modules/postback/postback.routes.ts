import { Router } from 'express';
import { validate } from '../../common/validate';
import { postbackController } from './postback.controller';
import { postbackQuerySchema } from './postback.dto';

export const postbackRoutes = Router();

// Public, server-to-server — authenticated by offer secret + allowed-IP check inside
// the service, not a JWT (the caller is an advertiser's tracking platform, not a
// logged-in user). Same trust model as /click.
postbackRoutes.get('/', validate(postbackQuerySchema, 'query'), postbackController.handlePostback);
