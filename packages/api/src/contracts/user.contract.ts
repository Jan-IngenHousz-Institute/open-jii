import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../schemas/experiment.schema";
import {
  zUser,
  zUserProfileList,
  zSearchUsersQuery,
  zUserIdPathParam,
  zCreateUserProfileBody,
  zCreateUserProfileResponse,
  zUserProfile,
} from "../schemas/user.schema";

const c = initContract();

export const userContract = c.router({
  searchUsers: {
    method: "GET",
    path: "/api/v1/users/search",
    query: zSearchUsersQuery,
    responses: {
      200: zUserProfileList,
      400: zErrorResponse,
    },
    summary: "Search users",
    description: "Search for users by name or email with pagination support",
  },

  getUser: {
    method: "GET",
    path: "/api/v1/users/:id",
    pathParams: zUserIdPathParam,
    responses: {
      200: zUser,
      404: zErrorResponse,
    },
    summary: "Get a user by ID",
    description: "Returns a single user by their unique identifier",
  },

  createUserProfile: {
    method: "POST",
    path: "/api/v1/users/profile",
    body: zCreateUserProfileBody,
    responses: {
      201: zCreateUserProfileResponse,
      400: zErrorResponse,
    },
    summary: "Create user profile",
    description: "Creates user profile and sets the user as registered",
  },

  getUserProfile: {
    method: "GET",
    path: "/api/v1/users/:id/profile",
    pathParams: zUserIdPathParam,
    responses: {
      200: zUserProfile,
      404: zErrorResponse,
    },
    summary: "Get user profile",
    description:
      "Returns the user's profile information including firstName, lastName, bio, and organization",
  },

  deleteUser: {
    method: "DELETE",
    path: "/api/v1/users/:id",
    pathParams: zUserIdPathParam,
    responses: {
      204: null,
      403: zErrorResponse,
      404: zErrorResponse,
    },
    summary: "Delete a user",
    description: "Deletes a user by their ID if allowed",
  },
});
