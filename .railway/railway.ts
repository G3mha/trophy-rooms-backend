import { defineRailway, github, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Redis = redis("Redis", { region: "us-east4-eqdc4a" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "us-east4-eqdc4a", sizeMB: 5000 });
  const trophyRoomsBackend = service("trophy-rooms-backend", {
    source: github("G3mha/trophy-rooms-backend", { checkSuites: false, rootDirectory: "/" }),
    replicas: { "us-east4-eqdc4a": 1 },
    domains: ["api.trophyrooms.org"],
    env: { DATABASE_URL: preserve(), DIRECT_URL: preserve(), FRONTEND_URL: preserve(), NODE_ENV: preserve(), NODE_OPTIONS: preserve(), REDIS_URL: preserve(), SUPABASE_SECRET_KEY: preserve(), SUPABASE_URL: preserve(), TWITCH_CLIENT_ID: preserve(), TWITCH_CLIENT_SECRET: preserve() },
  });

  // Carried over from railway.json, which `railway config migrate` drops.
  // railway.json set `builder: "DOCKERFILE"`, but the current Railway API no
  // longer has that value (Builder is HEROKU | NIXPACKS | PAKETO | RAILPACK).
  // Pointing at the Dockerfile explicitly is the supported equivalent.
  trophyRoomsBackend.build = { dockerfilePath: "Dockerfile", buildEnvironment: "V3" };
  trophyRoomsBackend.deploy = {
    healthcheckPath: "/health",
    restartPolicyType: "ON_FAILURE",
    restartPolicyMaxRetries: 10,
  };

  return project("trophy-rooms", {
    resources: [Redis, trophyRoomsBackend, redisVolume],
  });
});
