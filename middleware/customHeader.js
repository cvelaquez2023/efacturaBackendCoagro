const customHeader = (req, res, next) => {
  try {
    next();
  } catch (error) {
    res.status(403);
    res.send({ error: "Algo paso en CustoHeader" });
  }
};

module.exports = customHeader;
