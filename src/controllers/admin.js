const { asyncHandler } = require('../utils/errors');
const {
  createAppointment,
  cancelAppointmentByAdmin,
  updateAppointmentStatus,
  markAppointmentPaid,
  updateAppointmentNotes,
  rescheduleAppointment,
  listAppointments,
  getAppointmentDetail,
  getDashboard,
  getCalendar,
  exportAppointments
} = require('../services/booking');
const {
  listBarbers,
  createBarber,
  updateBarber,
  setBarberActive,
  deleteBarber
} = require('../services/barbers');
const {
  listServices,
  createService,
  updateService,
  setServiceActive,
  deleteService
} = require('../services/services');
const {
  listBlocks,
  previewAffected,
  createBlock,
  deleteBlock
} = require('../services/blocks');
const {
  getAdminSettings,
  updateSettings
} = require('../services/settings');
const {
  listUsers,
  createUser,
  setUserActive
} = require('../services/auth');
const { buildCsv, sendCsv } = require('../utils/csv');
const { formatDateTime, formatCurrency, todayStr } = require('../utils/datetime');

function filtersFromQuery(query) {
  return {
    barberId: query.barber_id,
    dateFrom: query.date_from,
    dateTo: query.date_to,
    status: query.status,
    paymentStatus: query.payment_status,
    search: query.search
  };
}

function mapBarberPayload(body) {
  return {
    name: body.name,
    photoUrl: body.photo_url,
    bio: body.bio,
    active: body.active,
    sortOrder: body.sort_order,
    serviceIds: body.service_ids,
    hours: (body.hours || []).map((hour) => ({
      weekday: hour.weekday,
      closed: hour.closed,
      start: hour.start,
      end: hour.end,
      breakStart: hour.break_start,
      breakEnd: hour.break_end
    }))
  };
}

function mapServicePayload(body) {
  return {
    name: body.name,
    description: body.description,
    price: body.price,
    durationMinutes: body.duration_minutes,
    active: body.active,
    sortOrder: body.sort_order
  };
}

const dashboard = asyncHandler(async (req, res) => {
  res.json(await getDashboard(req.user));
});

const appointmentsList = asyncHandler(async (req, res) => {
  const rows = await listAppointments(
    filtersFromQuery(req.query),
    req.user,
    req.query.limit || 500
  );
  res.json({ appointments: rows, count: rows.length });
});

const appointmentDetail = asyncHandler(async (req, res) => {
  res.json(await getAppointmentDetail({ id: req.params.id, user: req.user }));
});

const appointmentCreate = asyncHandler(async (req, res) => {
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
    paymentStatus: body.payment_status,
    createdByUserId: req.user.id,
    source: 'admin'
  });
  res.status(201).json({
    appointment: result.appointment,
    public: result.public
  });
});

const appointmentCancel = asyncHandler(async (req, res) => {
  const appointment = await cancelAppointmentByAdmin({
    id: req.params.id,
    reason: req.body.reason,
    user: req.user
  });
  res.json({ appointment });
});

const appointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await updateAppointmentStatus({
    id: req.params.id,
    status: req.body.status,
    user: req.user
  });
  res.json({ appointment });
});

const appointmentPayment = asyncHandler(async (req, res) => {
  const appointment = await markAppointmentPaid({
    id: req.params.id,
    user: req.user
  });
  res.json({ appointment });
});

const appointmentNotes = asyncHandler(async (req, res) => {
  const appointment = await updateAppointmentNotes({
    id: req.params.id,
    notes: req.body.notes,
    user: req.user
  });
  res.json({ appointment });
});

const appointmentReschedule = asyncHandler(async (req, res) => {
  const appointment = await rescheduleAppointment({
    id: req.params.id,
    date: req.body.date,
    time: req.body.time,
    barberId: req.body.barber_id,
    user: req.user
  });
  res.json({ appointment });
});

const appointmentsExport = asyncHandler(async (req, res) => {
  const rows = await exportAppointments(filtersFromQuery(req.query), req.user);
  const columns = [
    { key: 'code', label: 'Código' },
    { key: 'start_datetime', label: 'Inicio' },
    { key: 'end_datetime', label: 'Fin' },
    { key: 'barber_name', label: 'Barbero' },
    { key: 'service_name', label: 'Servicio' },
    { key: 'customer_name', label: 'Cliente' },
    { key: 'customer_phone', label: 'Teléfono' },
    { key: 'customer_email', label: 'Email' },
    { key: 'status', label: 'Estado' },
    { key: 'payment_method', label: 'Método de pago' },
    { key: 'payment_status', label: 'Estado de pago' },
    { key: 'price_at_booking', label: 'Precio' },
    { key: 'notes', label: 'Notas' }
  ];
  const data = rows.map((row) => ({
    ...row,
    start_datetime: formatDateTime(row.start_datetime),
    end_datetime: formatDateTime(row.end_datetime),
    price_at_booking: formatCurrency(row.price_at_booking)
  }));
  sendCsv(res, `citas-${todayStr()}.csv`, buildCsv(columns, data));
});

const calendar = asyncHandler(async (req, res) => {
  res.json(
    await getCalendar({
      start: req.query.start,
      end: req.query.end,
      barberId: req.query.barber_id,
      user: req.user
    })
  );
});

const barbersList = asyncHandler(async (req, res) => {
  res.json({ barbers: await listBarbers({ includeInactive: true }) });
});

const barberCreate = asyncHandler(async (req, res) => {
  res.status(201).json({
    barber: await createBarber(mapBarberPayload(req.body))
  });
});

const barberUpdate = asyncHandler(async (req, res) => {
  res.json({
    barber: await updateBarber(req.params.id, mapBarberPayload(req.body))
  });
});

const barberActive = asyncHandler(async (req, res) => {
  res.json({
    barber: await setBarberActive(req.params.id, req.body.active)
  });
});

const barberDelete = asyncHandler(async (req, res) => {
  await deleteBarber(req.params.id);
  res.json({ ok: true });
});

const servicesList = asyncHandler(async (req, res) => {
  res.json({ services: await listServices({ includeInactive: true }) });
});

const serviceCreate = asyncHandler(async (req, res) => {
  res.status(201).json({
    service: await createService(mapServicePayload(req.body))
  });
});

const serviceUpdate = asyncHandler(async (req, res) => {
  res.json({
    service: await updateService(req.params.id, mapServicePayload(req.body))
  });
});

const serviceActive = asyncHandler(async (req, res) => {
  res.json({
    service: await setServiceActive(req.params.id, req.body.active)
  });
});

const serviceDelete = asyncHandler(async (req, res) => {
  await deleteService(req.params.id);
  res.json({ ok: true });
});

const blocksList = asyncHandler(async (req, res) => {
  res.json({
    blocks: await listBlocks({
      includePast: req.query.include_past === 'true',
      barberId: req.query.barber_id
    })
  });
});

const blocksAffected = asyncHandler(async (req, res) => {
  res.json({
    affected: await previewAffected({
      barberId: req.query.barber_id,
      start: req.query.start,
      end: req.query.end
    })
  });
});

const blockCreate = asyncHandler(async (req, res) => {
  res.status(201).json(
    await createBlock({
      barberId: req.body.barber_id,
      start: req.body.start,
      end: req.body.end,
      reason: req.body.reason,
      createdBy: req.user.id,
      cancelAffected: req.body.cancel_affected
    })
  );
});

const blockDelete = asyncHandler(async (req, res) => {
  await deleteBlock(req.params.id);
  res.json({ ok: true });
});

const settingsGet = asyncHandler(async (req, res) => {
  res.json(await getAdminSettings());
});

const settingsUpdate = asyncHandler(async (req, res) => {
  const values = await updateSettings(req.body);
  res.json({ values });
});

const usersList = asyncHandler(async (req, res) => {
  res.json({ users: await listUsers() });
});

const userCreate = asyncHandler(async (req, res) => {
  const user = await createUser({
    username: req.body.username,
    password: req.body.password,
    role: req.body.role,
    barberId: req.body.barber_id,
    mustChangePassword: req.body.must_change_password
  });
  res.status(201).json({ user });
});

const userActive = asyncHandler(async (req, res) => {
  res.json({ user: await setUserActive(req.params.id, req.body.active) });
});

module.exports = {
  dashboard,
  appointmentsList,
  appointmentDetail,
  appointmentCreate,
  appointmentCancel,
  appointmentStatus,
  appointmentPayment,
  appointmentNotes,
  appointmentReschedule,
  appointmentsExport,
  calendar,
  barbersList,
  barberCreate,
  barberUpdate,
  barberActive,
  barberDelete,
  servicesList,
  serviceCreate,
  serviceUpdate,
  serviceActive,
  serviceDelete,
  blocksList,
  blocksAffected,
  blockCreate,
  blockDelete,
  settingsGet,
  settingsUpdate,
  usersList,
  userCreate,
  userActive
};
