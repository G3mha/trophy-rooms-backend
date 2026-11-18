import { ShowcaseList, SocialNetwork } from "@prisma/client";
import { builder } from "../builder.js";
import { socialProfileUrl } from "../../lib/profile.js";

export const ShowcaseListEnum = builder.enumType(ShowcaseList, {
  name: "ShowcaseList",
});

export const SocialNetworkEnum = builder.enumType(SocialNetwork, {
  name: "SocialNetwork",
});

builder.prismaObject("UserSocialLink", {
  fields: (t) => ({
    id: t.exposeID("id"),
    network: t.expose("network", { type: SocialNetworkEnum }),
    handle: t.exposeString("handle"),
    // Null for networks with no public profile page
    url: t.string({
      nullable: true,
      resolve: (link) => socialProfileUrl(link.network, link.handle),
    }),
  }),
});
