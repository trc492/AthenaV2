export type {
  DatabaseProvider,
  DatabaseFormState,
} from "@/lib/types/db/providers";
export {
  defaultDatabaseFormState,
  DATABASE_PROVIDERS,
  isDatabaseFormValid,
} from "@/lib/types/db/providers";

export interface AdminFormValues {
  name: string;
  username: string;
  password: string;
}

export interface SetupResult {
  success: boolean;
  error?: string;
}

export type SetupStep = "database" | "admin" | "complete";