class ApiResponse {
  constructor(
    statusCode = 200,
    data,
    message = "operation successful",
    reload = false,
    navigate = false,
    navigateTo = "/",
  ) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.reload = reload;
    this.navigate = navigate;
    this.navigateTo = navigateTo;
  }
}

export default ApiResponse;
