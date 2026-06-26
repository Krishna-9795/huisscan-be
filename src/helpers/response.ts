export function successResponse<T>(data: T, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

export function errorResponse(message: string) {
  return {
    success: false,
    message,
  };
}
