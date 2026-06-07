import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";

jest.spyOn(jwt, "sign").mockReturnValue("fake-jwt-token");
const mockCreateUser = jest.fn();
const mockLoginUser = jest.fn();

jest.unstable_mockModule("./auth.model.js", () => ({
  createUser: mockCreateUser,
  loginUser: mockLoginUser,
}));

test("register creates a user and returns 201", async () => {
  const fakeUser = {
    id: 1,
    email: "john@test.com",
    username: "John Doe",
  };

  mockCreateUser.mockResolvedValue(fakeUser);

  const req = {
    body: {
      email: "john@test.com",
      firstName: "John",
      lastName: "Doe",
      password: "secret",
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await register(req, res);

  expect(mockCreateUser).toHaveBeenCalledWith(
    "john@test.com",
    "John Doe",
    "secret"
  );

  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(fakeUser);
});


test("register returns 500 when database throws", async () => {
  mockCreateUser.mockRejectedValue(new Error("Database error"));

  const req = {
    body: {
      email: "john@test.com",
      firstName: "John",
      lastName: "Doe",
      password: "secret",
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await register(req, res);

  expect(res.status).toHaveBeenCalledWith(500);

  expect(res.json).toHaveBeenCalledWith({
    message: "Internal server error",
  });
});

test("login returns user and token", async () => {
  const fakeUser = {
    id: 1,
    email: "john@test.com",
    username: "John Doe",
    role: "user",
  };

  mockLoginUser.mockResolvedValue(fakeUser);

  const req = {
    body: {
      email: "john@test.com",
      password: "secret",
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    cookie: jest.fn(),
  };

  await login(req, res);

  expect(mockLoginUser).toHaveBeenCalledWith(
    "john@test.com",
    "secret"
  );

  expect(res.cookie).toHaveBeenCalled();

  expect(res.status).toHaveBeenCalledWith(200);

  expect(res.json).toHaveBeenCalledWith({
    user: fakeUser,
    token: "fake-jwt-token",
  });
});


test("login returns 401 when credentials are invalid", async () => {
  mockLoginUser.mockResolvedValue(null);

  const req = {
    body: {
      email: "wrong@test.com",
      password: "wrong",
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    cookie: jest.fn(),
  };

  await login(req, res);

  expect(res.status).toHaveBeenCalledWith(401);

  expect(res.json).toHaveBeenCalledWith({
    message: "Invalid credentials",
  });

  expect(res.cookie).not.toHaveBeenCalled();
});

const { register, login } = await import("./auth.controller.js");