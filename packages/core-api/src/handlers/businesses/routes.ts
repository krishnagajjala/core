import Hapi from "@hapi/hapi";

import { BusinessController } from "./controller";
import * as Schema from "./schema";

export const registerRoutes = (server: Hapi.Server): void => {
    const controller = server.app.app.resolve(BusinessController);
    server.bind(controller);

    server.route({
        method: "GET",
        path: "/businesses",
        handler: controller.index,
        options: {
            validate: Schema.index,
        },
    });

    server.route({
        method: "GET",
        path: "/businesses/{id}",
        handler: controller.show,
        options: {
            validate: Schema.show,
        },
    });

    server.route({
        method: "GET",
        path: "/businesses/{id}/bridgechains",
        handler: controller.show,
        options: {
            validate: Schema.show,
        },
    });

    server.route({
        method: "POST",
        path: "/businesses/search",
        handler: controller.search,
        options: {
            validate: Schema.search,
        },
    });
};