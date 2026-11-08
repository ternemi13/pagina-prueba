const express = require('express');
const { validate } = require('../utils/validate');
const schemas = require('./schemas');
const controller = require('../controllers/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');
const { requireAuthApi } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rate-limit');

const router = express.Router();

router.get('/csrf', controller.getCsrfToken);
router.get('/me', controller.me);

router.post(
  '/login',
  authLimiter,
  doubleCsrfProtection,
  validate({ body: schemas.loginBody }),
  controller.login
);
router.post('/logout', doubleCsrfProtection, controller.logout);
router.post(
  '/change-password',
  doubleCsrfProtection,
  requireAuthApi,
  validate({ body: schemas.changePasswordBody }),
  controller.updatePassword
);

module.exports = router;
