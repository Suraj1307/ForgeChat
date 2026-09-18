const notFound = (req, res) => {
  res.status(404).json({
    error: "Route not found.",
    code: "ROUTE_NOT_FOUND",
  });
};

export default notFound;
