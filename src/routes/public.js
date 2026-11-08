const express = require('express');
const { validate } = require('../utils/validate');
const schemas = require('./schemas');
const controller = require('../controllers/public');
const { doubleCsrfProtection } = require('../middleware/csrf');
const {
  publicBookingLimiter,
  publicLookupLimiter
} = require('../middleware/rate-limit');

const router = express.Router();

router.get('/health', controller.health);
router.get('/settings', controller.getSettings);
router.get('/services', controller.getServices);
router.get('/barbers', validate({ query: schemas.barbersQuery }), controller.getBarbers);

router.get(
  '/availability/days',
  publicLookupLimiter,
  validate({ query: schemas.publicDaysQuery }),
  controller.getAvailableDays
);
router.get(
  '/availability',
  publicLookupLimiter,
  validate({ query: schemas.publicAvailabilityQuery }),
  controller.getAvailability
);

router.post(
  '/appointments',
  doubleCsrfProtection,
  publicBookingLimiter,
  validate({ body: schemas.publicAppointmentBody }),
  controller.createAppointment
);
router.get(
  '/appointments/lookup',
  publicLookupLimiter,
  validate({ query: schemas.lookupQuery }),
  controller.lookupAppointment
);
router.post(
  '/appointments/:code/cancel',
  doubleCsrfProtection,
  publicBookingLimiter,
  validate({ params: schemas.codeParams, body: schemas.cancelBody }),
  controller.cancelAppointment
);

module.exports = router;
