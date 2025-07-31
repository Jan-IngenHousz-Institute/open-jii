import { initContract } from "@ts-rest/core";

import { zErrorResponse } from "../schemas/experiment.schema";
import {
  zUser,
  zUserList,
  zSearchUsersQuery,
  zUserIdPathParam,
  zCreateUserProfileBody,
  zCreateUserProfileResponse,
} from "../schemas/user.schema";

const c = initContract();

export const userContract = c.router({
  searchUsers: {
    method: "GET",
    path: "/api/v1/users/search",
    query: zSearchUsersQuery,
    responses: {
      200: zUserList,
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
});
