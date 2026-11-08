const { z } = require('zod');
const {
  isValidDateString,
  isValidTimeString,
  isValidMonthString
} = require('./datetime');
const { normalizePhone } = require('./phone');
const { badRequest } = require('./errors');

function formatZodIssues(error) {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'general',
    message: issue.message
  }));
}

function validate(schemas) {
  return function validateRequest(req, res, next) {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          badRequest(
            'Revisa los datos del formulario e inténtalo de nuevo.',
            formatZodIssues(error)
          )
        );
        return;
      }
      next(error);
    }
  };
}

const idSchema = z.coerce.number().int().positive();
const dateSchema = z
  .string()
  .trim()
  .refine(isValidDateString, 'La fecha no es válida. Usa el formato AAAA-MM-DD.');
const timeSchema = z
  .string()
  .trim()
  .refine(isValidTimeString, 'La hora no es válida. Usa el formato HH:MM.');
const monthSchema = z
  .string()
  .trim()
  .refine(isValidMonthString, 'El mes no es válido. Usa el formato AAAA-MM.');

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'El teléfono es obligatorio.')
  .transform(normalizePhone)
  .refine((value) => value !== null, 'Escribe un teléfono colombiano de 10 dígitos.');

const optionalEmailSchema = z
  .union([z.string().trim().email('El email no es válido.'), z.literal(''), z.null(), z.undefined()])
  .transform((value) => (value ? value.toLowerCase() : null));

const notesSchema = z
  .union([z.string().trim().max(500, 'Las notas no pueden superar 500 caracteres.'), z.literal(''), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(100, 'El nombre no puede superar 100 caracteres.');

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,4}-[A-Z0-9]{5}$/, 'El código de reserva no es válido.');

const paymentMethodSchema = z.enum(['cash_on_site', 'bank_transfer'], {
  message: 'El método de pago no es válido.'
});

const appointmentStatusSchema = z.enum(['confirmed', 'completed', 'cancelled', 'no_show']);
const paymentStatusSchema = z.enum(['pending', 'paid']);

const barberSelectorSchema = z
  .string()
  .trim()
  .regex(/^(any|\d+)$/, 'Selecciona un barbero válido.')
  .transform((value) => (value === 'any' ? 'any' : Number(value)));

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(128, 'La contraseña no puede superar 128 caracteres.');

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'El usuario debe tener al menos 3 caracteres.')
  .max(60, 'El usuario no puede superar 60 caracteres.')
  .regex(
    /^[A-Za-z0-9._-]+$/,
    'El usuario solo puede usar letras, números, punto, guion y guion bajo.'
  );

const priceSchema = z.coerce
  .number()
  .int('El precio debe ser un número entero.')
  .min(0, 'El precio no puede ser negativo.')
  .max(100000000, 'El precio es demasiado alto.');

const durationSchema = z.coerce
  .number()
  .int('La duración debe ser un número entero.')
  .positive('La duración debe ser mayor que cero.')
  .max(480, 'La duración no puede superar 480 minutos.');

const weekdaySchema = z.coerce.number().int().min(0).max(6);
const booleanSchema = z.boolean();
const sortOrderSchema = z.coerce.number().int().min(-9999).max(9999);

module.exports = {
  z,
  formatZodIssues,
  validate,
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
};
