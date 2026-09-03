import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockAuthSession, mockWriteFile, mockMkdir, mockExistsSync, mockReadFileSync } = vi.hoisted(() => {
  return {
    mockAuthSession: { value: { user: { id: "user-admin", role: "admin" } } as any },
    mockWriteFile: vi.fn(),
    mockMkdir: vi.fn(),
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
  };
});

vi.mock("@/lib/auth/config", () => ({
  auth: vi.fn(async () => mockAuthSession.value),
}));

vi.mock("@/lib/auth/roles", () => ({
  hasPermission: vi.fn((role: string) => role === "admin"),
  PERMISSIONS: {
    MANAGE_SYSTEM_CONFIG: "manage_system_config",
  },
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
  };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  };
});

describe("API Keys Server Functions", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TBA_API_KEY;
    delete process.env.FTC_API_KEY;
    delete process.env.NEXUS_API_KEY;
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns none when no keys are configured via env or json", async () => {
    const { getApiKeyStatus, loadApiKeys } = await import("@/lib/server/api-keys");
    const status = getApiKeyStatus();
    expect(status.tbaApiKey).toEqual({ configured: false, source: "none" });
    expect(status.ftcApiKey).toEqual({ configured: false, source: "none" });
    expect(status.nexusApiKey).toEqual({ configured: false, source: "none" });

    const keys = loadApiKeys();
    expect(keys).toEqual({ tbaApiKey: "", ftcApiKey: "", nexusApiKey: "" });
  });

  it("identifies external environment variables as source: env", async () => {
    process.env.TBA_API_KEY = "env-tba-key";
    const { getApiKeyStatus, loadApiKeys } = await import("@/lib/server/api-keys");
    const status = getApiKeyStatus();

    expect(status.tbaApiKey).toEqual({ configured: true, source: "env" });
    expect(status.ftcApiKey).toEqual({ configured: false, source: "none" });

    const keys = loadApiKeys();
    expect(keys.tbaApiKey).toBe("env-tba-key");
  });

  it("identifies persisted keys as source: persisted even when process.env is populated", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ tbaApiKey: "persisted-tba-key", ftcApiKey: "persisted-ftc-key" }),
    );
    // Simulating saveApiKeys having mirrored to process.env
    process.env.TBA_API_KEY = "persisted-tba-key";
    process.env.FTC_API_KEY = "persisted-ftc-key";

    const { getApiKeyStatus, loadApiKeys } = await import("@/lib/server/api-keys");
    const status = getApiKeyStatus();

    expect(status.tbaApiKey).toEqual({ configured: true, source: "persisted" });
    expect(status.ftcApiKey).toEqual({ configured: true, source: "persisted" });
    expect(status.nexusApiKey).toEqual({ configured: false, source: "none" });

    const keys = loadApiKeys();
    expect(keys.tbaApiKey).toBe("persisted-tba-key");
    expect(keys.ftcApiKey).toBe("persisted-ftc-key");
  });

  it("saveApiKeys persists keys and updates process.env in memory", async () => {
    mockExistsSync.mockReturnValue(false);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const { saveApiKeys } = await import("@/lib/server/api-keys");
    await saveApiKeys({ tbaApiKey: "new-key-123" });

    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(writtenContent.tbaApiKey).toBe("new-key-123");
    expect(process.env.TBA_API_KEY).toBe("new-key-123");
  });

  it("clearing a key removes it from process.env", async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify({ tbaApiKey: "existing-key" }));
    process.env.TBA_API_KEY = "existing-key";

    const { saveApiKeys } = await import("@/lib/server/api-keys");
    await saveApiKeys({ tbaApiKey: "" });

    const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
    expect(writtenContent.tbaApiKey).toBe("");
    expect(process.env.TBA_API_KEY).toBeUndefined();
  });
});

describe("/api/system/api-keys Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthSession.value = { user: { id: "user-admin", role: "admin" } };
    mockExistsSync.mockReturnValue(false);
  });

  it("GET returns status for authorized admins", async () => {
    const route = await import("@/app/api/system/api-keys/route");
    const res = await route.GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("status");
    expect(data.status).toHaveProperty("tbaApiKey");
  });

  it("GET rejects unauthorized users", async () => {
    mockAuthSession.value = { user: { id: "user-scout", role: "scout" } };
    const route = await import("@/app/api/system/api-keys/route");
    const res = await route.GET();
    expect(res.status).toBe(403);
  });

  it("POST saves valid keys and returns updated status", async () => {
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const route = await import("@/app/api/system/api-keys/route");
    const req = new Request("http://test/api/system/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tbaApiKey: "tba-test-key" }),
    });

    const res = await route.POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data).toHaveProperty("status");
  });
});
