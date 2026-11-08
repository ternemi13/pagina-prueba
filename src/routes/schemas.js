const {
  z,
  idSchema,
  dateSchema,
  timeSchema,
  monthSchema,
  phoneSchema,
  optionalEmailSchema,
  notesSchema,
  nameSchema,
  codeSchema,
  paymentMethodSchema,
  appointmentStatusSchema,
  paymentStatusSchema,
  barberSelectorSchema,
  passwordSchema,
  usernameSchema,
  priceSchema,
  durationSchema,
  weekdaySchema,
  booleanSchema,
  sortOrderSchema
} = require('../utils/validate');
const { parseDb } = require('../utils/datetime');

const optionalIdSchema = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const optionalText = (maxLength) =>
  z
    .union([z.string().trim().max(maxLength), z.literal(''), z.null(), z.undefined()])
    .transform((value) => (value ? value : null));

const barberSelectorBodySchema = z
  .union([z.literal('any'), z.coerce.number().int().positive()])
  .transform((value) => (value === 'any' ? 'any' : Number(value)));

const datetimeSchema = z
  .string()
  .trim()
  .min(1, 'La fecha y hora son obligatorias.')
  .refine((value) => parseDb(value).isValid(), 'La fecha y hora no son válidas.');

const barbersQuery = z.object({
  service_id: optionalIdSchema
});

const publicAvailabilityQuery = z.object({
  service_id: idSchema,
  barber_id: barberSelectorSchema.default('any'),
  date: dateSchema
});

const publicDaysQuery = z.object({
  service_id: idSchema,
  barber_id: barberSelectorSchema.default('any'),
  month: monthSchema
});

const publicAppointmentBody = z.object({
  service_id: idSchema,
  barber_id: barberSelectorBodySchema.default('any'),
  date: dateSchema,
  time: timeSchema,
  customer_name: nameSchema,
  customer_phone: phoneSchema,
  customer_email: optionalEmailSchema,
  notes: notesSchema,
  payment_method: paymentMethodSchema
});

const lookupQuery = z.object({
  code: codeSchema,
  phone: phoneSchema
});

const cancelBody = z.object({
  phone: phoneSchema,
  reason: notesSchema
});

const loginBody = z.object({
  username: usernameSchema,
  password: passwordSchema
});

const changePasswordBody = z.object({
  current_password: passwordSchema,
  new_password: passwordSchema
});

const idParams = z.object({
  id: idSchema
});

const codeParams = z.object({
  code: codeSchema
});

const adminListQuery = z.object({
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
  status: appointmentStatusSchema.optional(),
  payment_status: paymentStatusSchema.optional(),
  barber_id: optionalIdSchema,
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional()
});

const adminCalendarQuery = z.object({
  start: dateSchema,
  end: dateSchema,
  barber_id: optionalIdSchema
});

const adminCreateAppointmentBody = z.object({
  service_id: idSchema,
  barber_id: barberSelectorBodySchema.default('any'),
  date: dateSchema,
  time: timeSchema,
  customer_name: nameSchema,
  customer_phone: phoneSchema,
  customer_email: optionalEmailSchema,
  notes: notesSchema,
  payment_method: paymentMethodSchema,
  payment_status: paymentStatusSchema.default('pending')
});

const statusBody = z.object({
  status: z.enum(['completed', 'no_show'])
});

const cancelAdminBody = z.object({
  reason: notesSchema
});

const rescheduleBody = z.object({
  date: dateSchema,
  time: timeSchema,
  barber_id: barberSelectorBodySchema.optional()
});

const notesBody = z.object({
  notes: notesSchema
});

const barberBody = z.object({
  name: nameSchema,
  photo_url: optionalText(500),
  bio: optionalText(500),
  active: booleanSchema.optional(),
  sort_order: sortOrderSchema.optional(),
  service_ids: z.array(idSchema).max(100),
  hours: z
    .array(
      z.object({
        weekday: weekdaySchema,
        closed: z.boolean().optional(),
        start: z.string().trim().optional(),
        end: z.string().trim().optional(),
        break_start: z.string().trim().optional().nullable(),
        break_end: z.string().trim().optional().nullable()
      })
    )
    .max(7)
});

const serviceBody = z.object({
  name: nameSchema,
  description: optionalText(500),
  price: priceSchema,
  duration_minutes: durationSchema,
  active: booleanSchema.optional(),
  sort_order: sortOrderSchema.optional()
});

const blockBody = z.object({
  barber_id: optionalIdSchema,
  start: datetimeSchema,
  end: datetimeSchema,
  reason: optionalText(255),
  cancel_affected: z.boolean().optional().default(false)
});

const blockAffectedQuery = z.object({
  barber_id: optionalIdSchema,
  start: datetimeSchema,
  end: datetimeSchema
});

const blocksListQuery = z.object({
  barber_id: optionalIdSchema,
  include_past: z.enum(['true', 'false']).optional()
});

const activeBody = z.object({
  active: z.boolean()
});

const userBody = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'barber']),
  barber_id: optionalIdSchema,
  must_change_password: z.boolean().optional()
});

module.exports = {
  optionalIdSchema,
  barbersQuery,
  publicAvailabilityQuery,
  publicDaysQuery,
  publicAppointmentBody,
  lookupQuery,
  cancelBody,
  loginBody,
  changePasswordBody,
  idParams,
  codeParams,
  adminListQuery,
  adminCalendarQuery,
  adminCreateAppointmentBody,
  statusBody,
  cancelAdminBody,
  rescheduleBody,
  notesBody,
  barberBody,
  serviceBody,
  blockBody,
  blockAffectedQuery,
  blocksListQuery,
  activeBody,
  userBody
};
