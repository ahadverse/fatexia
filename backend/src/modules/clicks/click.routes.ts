import { Router } from 'express';
import { validate } from '../../common/validate';
import { clickController } from './click.controller';
import { clickQuerySchema } from './click.dto';

export const clickRoutes = Router();

clickRoutes.get('/', validate(clickQuerySchema, 'query'), clickController.handleClick);
