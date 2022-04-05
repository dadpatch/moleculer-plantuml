'use strict';

var plantumlEncoder = require('plantuml-encoder');

module.exports = {
  settings: {
    onlyLocal: false, // build schema from only local services
    type: 'class', // class, entity
  },

  methods: {
    getServiceName(service) {
      return service.fullName;
    },

    getServicePackage(service) {
      return false;
    },

    getServiceStereotype(service) {
      if (service.settings.rest) {
        return service.settings.rest;
      }

      return false;
    },

    getActionStereotype(action, service) {
      if (service.actions?.[action]?.rest) {
        return service.actions[action].rest;
      }

      return false;
    },

    getServiceFields(service) {
      if (Array.isArray(service.settings.fields)) {
        return service.settings.fields;
      }

      if (typeof service.settings.fields === 'object') {
        return Object.keys(service.settings.fields);
      }

      return [];
    },

    getFieldName(field, service) {
      return field;
    },

    getFieldType(field, service) {
      if (service?.settings?.fields?.[field]?.type) {
        return service.settings.fields[field].type;
      }

      return false;
    },

    getFieldVisibility(field, service) {
      if (service?.settings?.fields?.[field]) {
        const fieldSettings = service.settings.fields[field];

        if (fieldSettings.hidden === true) {
          return '-';
        } else if (fieldSettings.hidden === 'byDefault') {
          return '#';
        }

        return '+';
      }

      return false;
    },

    getActionName(action, service) {
      if (service.actions?.[action]?.rawName) {
        return service.actions[action].rawName;
      }

      return action;
    },

    getActionVisibility(action, service) {
      if (service?.actions?.[action]) {
        const actionSettings = service.actions[action];

        if (actionSettings.visibility === 'private') {
          return '-';
        } else if (actionSettings.visibility === 'protected') {
          return '#';
        } else if (actionSettings.visibility === 'publised') {
          return '~';
        }

        return '+';
      }

      return false;
    },

    shouldIncludeService(service) {
      if (service?.settings?.plantuml === false) {
        return false;
      }

      return true;
    },

    isFieldStatic(field, service) {
      if (service.settings?.fields?.[field]?.primaryKey) {
        return true;
      }

      return false;
    },

    generateSchemaForField(field, service) {
      const fieldName = this.getFieldName(field, service);
      const fieldType = this.getFieldType(field, service);
      const fieldVisibility = this.getFieldVisibility(field, service);

      let displayName = fieldName;
      if (fieldVisibility) {
        displayName = `${fieldVisibility} ${displayName}`
      }

      if (fieldType) {
        displayName = `${displayName} : ${fieldType}`
      }

      const staticSchema = this.isFieldStatic(field, service) ? ' {static}' : '';
      return `{field}${staticSchema} ${displayName}`;
    },

    generateSchemaForAction(action, service) {
      const actionName = this.getActionName(action, service);
      const actionVisibility = this.getActionVisibility(action, service);
      const actionStereotype = this.getActionStereotype(action, service);

      let displayName = actionName;
      if (actionVisibility) {
        displayName = `${actionVisibility} ${displayName}`
      }

      displayName = `{method} ${displayName}()`;

      if (actionStereotype) {
        displayName = `${displayName} <<${actionStereotype}>>`
      }

      return displayName;
    },

    fetchServicesWithActions() {
      return this.broker.call('$node.services', {
        withActions: true,
        onlyLocal: this.settings.onlyLocal,
      });
    },

    getUniqueServiceNameWithPackage(service, index) {
      return this.getServicePackage(service) ? `${this.getServicePackage(service)}.service${index}` : `service${index}`
    },

    generateSchemaForService(service, serviceNameMap) {
      const schema = [];
      const uniqueName = serviceNameMap.get(service.fullName);

      const stereotype = this.getServiceStereotype(service) ? ` <<${this.getServiceStereotype(service)}>>` : '';
      schema.push(`${this.settings.type} "${this.getServiceName(service)}" as ${uniqueName}${stereotype} {`);

      const fields = this.getServiceFields(service);

      if (Array.isArray(fields) && fields.length) {
        const fieldSchemas = fields.map(field => this.generateSchemaForField(field, service));
        schema.push(fieldSchemas.join('\n'));
      }

      const actions = Object.keys(service.actions);
      if (Array.isArray(actions) && actions.length) {
        const actionSchemas = actions.map(action => this.generateSchemaForAction(action, service));
        schema.push(actionSchemas.join('\n'));
      }

      schema.push(`}`);

      return schema.join('\n');
    },

    generateSchemaForServiceRelations(service, serviceNameMap) {
      const schema = [];
      const sourceName = serviceNameMap.get(service.fullName);

      const leftMap = {
        'zero-or-one': '|o',
        'one': '||',
        'zero-or-many': '}o',
        'one-or-many': '}|',
      };

      const rightMap = {
        'zero-or-one': 'o|',
        'one': '||',
        'zero-or-many': 'o{',
        'one-or-many': '|{',
      };

      if (service.settings?.plantuml?.relations) {
        const relations = service.settings.plantuml.relations;
        for (const targetService in relations) {
          if (serviceNameMap.has(targetService)) {
            const targetName = serviceNameMap.get(targetService);
            const relation = relations[targetService];

            const [left, right] = relation.split('-to-');

            schema.push(`${sourceName} ${leftMap[left]}--${rightMap[right]} ${targetName}`)
          }
        }
      }

      return schema.join('\n');
    },

    async generateSchema() {
      const schema = [];
      schema.push('@startuml')

      // avoid problems with angled crows feet
      schema.push('skinparam linetype ortho');

      const services = await this.fetchServicesWithActions();
      const servicesFiltered = services.filter(this.shouldIncludeService)

      const serviceNameMap = new Map();
      servicesFiltered.forEach((service, index) => serviceNameMap.set(service.fullName, this.getUniqueServiceNameWithPackage(service, index)));

      const serviceSchemas = servicesFiltered
            .map(service => this.generateSchemaForService(service, serviceNameMap))
      schema.push(serviceSchemas.join('\n\n'))

      const serviceRelationsSchemas = servicesFiltered
            .map(service => this.generateSchemaForServiceRelations(service, serviceNameMap))
      schema.push(serviceRelationsSchemas.join('\n\n'))

      schema.push('@enduml')

      return schema.join('\n');
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

      async handler(ctx) {
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
