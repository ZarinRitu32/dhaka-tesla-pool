const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Dhaka Tesla Pool API",
      version: "1.0.0",
      description:
        "Ride-pooling MVP for Dhaka's fleet of unaffiliated three-seat electric rickshaws (\"Teslas\"). " +
        "Try it with the seeded cast: Jashim (driver of Bullet), Nusrat, Rafiq, Shirin.",
    },
    servers: [{ url: "/", description: "Current host" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);
