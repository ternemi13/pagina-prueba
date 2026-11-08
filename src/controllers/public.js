const { asyncHandler } = require('../utils/errors');
const { one } = require('../db/pool');
const { getPublicSettings } = require('../services/settings');
const { getPublicServices } = require('../services/services');
const { getPublicBarbers } = require('../services/barbers');
const { getAvailability, getAvailableDays } = require('../services/availability-db');
const {
  createAppointment,
  lookupAppointment,
  cancelAppointmentByClient
} = require('../services/booking');

const getSettings = asyncHandler(async (req, res) => {
  res.json(await getPublicSettings());
});

const getServices = asyncHandler(async (req, res) => {
  res.json({ services: await getPublicServices() });
});

const getBarbers = asyncHandler(async (req, res) => {
  const serviceId = req.query.service_id ? Number(req.query.service_id) : null;
  res.json({ barbers: await getPublicBarbers({ serviceId }) });
});

const getAvailabilityHandler = asyncHandler(async (req, res) => {
  const result = await getAvailability({
    serviceId: req.query.service_id,
    barberId: req.query.barber_id,
    date: req.query.date
  });
  res.json(result);
});

const getAvailableDaysHandler = asyncHandler(async (req, res) => {
  const result = await getAvailableDays({
    serviceId: req.query.service_id,
    barberId: req.query.barber_id,
    month: req.query.month
  });
  res.json(result);
});

const createAppointmentHandler = asyncHandler(async (req, res) => {
  const body = req.body;
  const result = await createAppointment({
    serviceId: body.service_id,
    barberId: body.barber_id,
    date: body.date,
    time: body.time,
    customerName: body.customer_name,
    customerPhone: body.customer_phone,
    customerEmail: body.customer_email,
    notes: body.notes,
    paymentMethod: body.payment_method,
    source: 'public'
  });
  res.status(201).json({
    appointment: result.public,
    rules: result.rules
  });
});

const lookupAppointmentHandler = asyncHandler(async (req, res) => {
  const appointment = await lookupAppointment({
    code: req.query.code,
    phone: req.query.phone
  });
  res.json({ appointment });
});

const cancelAppointmentHandler = asyncHandler(async (req, res) => {
  const appointment = await cancelAppointmentByClient({
    code: req.params.code,
    phone: req.body.phone,
    reason: req.body.reason
  });
  res.json({ appointment });
});

const health = asyncHandler(async (req, res) => {
  try {
    await one('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

module.exports = {
  getSettings,
  getServices,
  getBarbers,
  getAvailability: getAvailabilityHandler,
  getAvailableDays: getAvailableDaysHandler,
  createAppointment: createAppointmentHandler,
  lookupAppointment: lookupAppointmentHandler,
  cancelAppointment: cancelAppointmentHandler,
  health
};
