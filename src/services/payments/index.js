const { badRequest } = require('../../utils/errors');
const {
  buildPaymentMethods,
  buildTransferData
} = require('../settings');

function getPaymentMethods(values) {
  return buildPaymentMethods(values);
}

function isPaymentMethodEnabled(method, values) {
  return getPaymentMethods(values).some((item) => item.value === method);
}

function validatePaymentMethod(method, values) {
  if (!['cash_on_site', 'bank_transfer'].includes(method)) {
    throw badRequest('El método de pago no es válido.');
  }
  if (!isPaymentMethodEnabled(method, values)) {
    throw badRequest('Ese método de pago no está habilitado.');
  }
  return method;
}

function getTransferInstructions(values) {
  return {
    ...buildTransferData(values),
    instructions: values.transfer_instructions,
    note: values.payment_note
  };
}

function getPaymentStatusLabel(status) {
  return status === 'paid' ? 'Pagada' : 'Pendiente';
}

function getPaymentMethodLabel(method, values) {
  const found = getPaymentMethods(values).find((item) => item.value === method);
  if (found) return found.label;
  return method === 'bank_transfer' ? 'Transferencia' : 'Pago en el local';
}

module.exports = {
  getPaymentMethods,
  isPaymentMethodEnabled,
  validatePaymentMethod,
  getTransferInstructions,
  getPaymentStatusLabel,
  getPaymentMethodLabel
};
