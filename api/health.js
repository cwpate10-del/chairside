// Read-only. Writes nothing, touches no storage, costs one invocation.
// Exists so config can be checked without creating a submission to find out,
// and so it is obvious which deployment is actually serving traffic.
export default {
  fetch() {
    return new Response(
      JSON.stringify(
        {
          ok: true,
          commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
          env: process.env.VERCEL_ENV || null,
          config: {
            // presence only, never values
            resendKey: Boolean(process.env.RESEND_API_KEY),
            blobStore: Boolean(process.env.BLOB_STORE_ID),
          },
        },
        null,
        2,
      ),
      { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
    );
  },
};
