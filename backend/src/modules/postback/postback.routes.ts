import { Router } from 'express';
import { postbackController } from './postback.controller';

export const postbackRoutes = Router();

// Public, server-to-server — authenticated by offer secret + allowed-IP check inside
// the service, not a JWT (the caller is an advertiser's tracking platform, not a
// logged-in user). Same trust model as /click.
//
// Deliberately without the `validate` middleware every other route uses: the controller
// runs the same schema itself so that a malformed postback is recorded in the postback
// log before it is refused. Under the middleware those requests were rejected in front
// of the logging and vanished without trace. See postback.controller.ts.
postbackRoutes.get('/', postbackController.handlePostback);
