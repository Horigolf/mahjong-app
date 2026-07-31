import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * Realtime Broadcast で部屋全体に公開更新を送る。
 *
 * 重要: 対局中の非公開情報（concealed_tiles・待ちなど）は含めないこと。
 * 例外: 局終了後の和了演出向けに、和了者の手牌・副露の公開は許容する。
 */
export async function broadcastPublicUpdate(
  supabase: SupabaseClient,
  roomId: string,
  payload: object,
): Promise<void> {
  const topic = `room:${roomId}`;
  const channel = supabase.channel(topic);

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void supabase.removeChannel(channel);
      reject(new Error("Realtime subscribe timeout"));
    }, 5000);

    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;

      clearTimeout(timeout);
      channel
        .send({
          type: "broadcast",
          event: "game_update",
          payload,
        })
        .then((result) => {
          void supabase.removeChannel(channel);
          if (result === "error") {
            reject(new Error("Broadcast send failed"));
            return;
          }
          resolve();
        })
        .catch((err) => {
          void supabase.removeChannel(channel);
          reject(err);
        });
    });
  });
}
