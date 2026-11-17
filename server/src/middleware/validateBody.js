export function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(({ path, message }) => ({
        field: path.join('.'),
        message: message.replaceAll('"', ''),
      }));
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Please check the highlighted fields.',
          details,
        },
      });
    }

    req.body = value;
    next();
  };
}
