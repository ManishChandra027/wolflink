export function buildRegistrationPayload(values) {
  return {
    name: values.name.trim(),
    username: values.username.trim().toLowerCase(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    phone: values.phone.trim(),
  };
}
