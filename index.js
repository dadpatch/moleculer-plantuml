'use strict';

var plantumlEncoder = require('plantuml-encoder');

export default {
  settings: {
    onlyLocal: false, // build schema from only local services
  },

  methods: {
    fetchServicesWithActions() {
      return this.broker.call('$node.services', {
        withActions: true,
        onlyLocal: this.settings.onlyLocal,
      });
    },

    async generateSchema() {
      // const nodes = await this.fetchServicesWithActions();
      let plantuml = `@startuml\n\n`;
      plantuml += `Bob -> Alice : hello`;
      plantuml += `\n\n@enduml`;

      return plantuml;
    },
  },

  actions: {
    generate: {
      params: {
        output: {
          type: 'enum',
          values: ['png', 'svg', 'txt', 'source'],
          default: 'png',
        },
      },

      async handler(ctx: any) {
        const schema = await this.generateSchema();

        if (ctx.params.output === 'source') {
          ctx.meta.$responseType = 'text';
          return schema;
        }

        ctx.meta.$responseType = 'text/html';
        const encoded = plantumlEncoder.encode(schema);
        const url = 'http://www.plantuml.com/plantuml/img/' + encoded;
        return `<img src="${url}" />`;
      },
    },
  },
};
