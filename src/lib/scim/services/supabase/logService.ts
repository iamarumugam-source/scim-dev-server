import { supabase } from "../../db";

const LOG_TABLE = "scim_logs";

export interface LogEntry {
  id: string;
  log_data: unknown;
  response: unknown;
  created_at: string;
}

export class LogService {
  async insertLog(
    userId: string,
    requestData: unknown,
    responseData: unknown,
  ): Promise<void> {
    const { error } = await supabase.from(LOG_TABLE).insert({
      log_data: requestData,
      tenantId: userId,
      response: responseData,
    });
    if (error) throw new Error(`Supabase error saving log: ${error.message}`);
  }

  async deleteLogs(userId: string): Promise<void> {
    const { error } = await supabase
      .from(LOG_TABLE)
      .delete()
      .eq("tenantId", userId);
    if (error) throw new Error(`Supabase error clearing logs: ${error.message}`);
  }

  async getLogs(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ logs: LogEntry[]; total: number }> {
    const { data, error, count } = await supabase
      .from(LOG_TABLE)
      .select("id, log_data, response, created_at", { count: "exact" })
      .eq("tenantId", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Supabase error fetching logs: ${error.message}`);

    const logs = (data ?? []).map((item) => ({
      id:         item.id,
      log_data:   item.log_data,
      response:   item.response,
      created_at: item.created_at,
    }));

    return { logs, total: count ?? 0 };
  }
}
