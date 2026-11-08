const express = require('express');
const { validate } = require('../utils/validate');
const schemas = require('./schemas');
const controller = require('../controllers/admin');
const { requireAuthApi, requireRole, noCache } = require('../middleware/auth');
const { doubleCsrfProtection } = require('../middleware/csrf');

const router = express.Router();
const adminOnly = requireRole('admin');

router.use(requireAuthApi, noCache, doubleCsrfProtection);

router.get('/dashboard', controller.dashboard);

router.get(
  '/appointments',
  validate({ query: schemas.adminListQuery }),
  controller.appointmentsList
);
router.get(
  '/appointments/export',
  validate({ query: schemas.adminListQuery }),
  controller.appointmentsExport
);
router.post(
  '/appointments',
  adminOnly,
  validate({ body: schemas.adminCreateAppointmentBody }),
  controller.appointmentCreate
);
router.get(
  '/appointments/:id',
  validate({ params: schemas.idParams }),
  controller.appointmentDetail
);
router.post(
  '/appointments/:id/cancel',
  validate({ params: schemas.idParams, body: schemas.cancelAdminBody }),
  controller.appointmentCancel
);
router.patch(
  '/appointments/:id/status',
  validate({ params: schemas.idParams, body: schemas.statusBody }),
  controller.appointmentStatus
);
router.patch(
  '/appointments/:id/payment',
  validate({ params: schemas.idParams }),
  controller.appointmentPayment
);
router.patch(
  '/appointments/:id/notes',
  validate({ params: schemas.idParams, body: schemas.notesBody }),
  controller.appointmentNotes
);
router.patch(
  '/appointments/:id/reschedule',
  validate({ params: schemas.idParams, body: schemas.rescheduleBody }),
  controller.appointmentReschedule
);

router.get(
  '/calendar',
  validate({ query: schemas.adminCalendarQuery }),
  controller.calendar
);

router.get('/barbers', adminOnly, controller.barbersList);
router.post(
  '/barbers',
  adminOnly,
  validate({ body: schemas.barberBody }),
  controller.barberCreate
);
router.put(
  '/barbers/:id',
  adminOnly,
  validate({ params: schemas.idParams, body: schemas.barberBody }),
  controller.barberUpdate
);
router.patch(
  '/barbers/:id/active',
  adminOnly,
  validate({ params: schemas.idParams, body: schemas.activeBody }),
  controller.barberActive
);
router.delete(
  '/barbers/:id',
  adminOnly,
  validate({ params: schemas.idParams }),
  controller.barberDelete
);

router.get('/services', adminOnly, controller.servicesList);
router.post(
  '/services',
  adminOnly,
  validate({ body: schemas.serviceBody }),
  controller.serviceCreate
);
router.put(
  '/services/:id',
  adminOnly,
  validate({ params: schemas.idParams, body: schemas.serviceBody }),
  controller.serviceUpdate
);
router.patch(
  '/services/:id/active',
  adminOnly,
  validate({ params: schemas.idParams, body: schemas.activeBody }),
  controller.serviceActive
);
router.delete(
  '/services/:id',
  adminOnly,
  validate({ params: schemas.idParams }),
  controller.serviceDelete
);

router.get(
  '/blocks',
  adminOnly,
  validate({ query: schemas.blocksListQuery }),
  controller.blocksList
);
router.get(
  '/blocks/affected',
  adminOnly,
  validate({ query: schemas.blockAffectedQuery }),
  controller.blocksAffected
);
router.post(
  '/blocks',
  adminOnly,
  validate({ body: schemas.blockBody }),
  controller.blockCreate
);
router.delete(
  '/blocks/:id',
  adminOnly,
  validate({ params: schemas.idParams }),
  controller.blockDelete
);

router.get('/settings', adminOnly, controller.settingsGet);
router.put('/settings', adminOnly, controller.settingsUpdate);

router.get('/users', adminOnly, controller.usersList);
router.post(
  '/users',
  adminOnly,
  validate({ body: schemas.userBody }),
  controller.userCreate
);
router.patch(
  '/users/:id/active',
  adminOnly,
  validate({ params: schemas.idParams, body: schemas.activeBody }),
  controller.userActive
);

module.exports = router;
