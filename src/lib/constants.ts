/**
 * Application constants
 */

// Storage keys
export const STORAGE_KEYS = {
  HISTORY: "postman_clone_history_v1",
  ENVIRONMENTS: "postman_clone_envs_v1",
  COLLECTION: "postman_clone_saved_requests_v1",
} as const

// Configuration
export const CONFIG = {
  HISTORY_LIMIT: 25,
  DEFAULT_URL: "https://jsonplaceholder.typicode.com/posts/1" as string,
} as const

// HTTP Methods
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
