const fieldHandler = require('./fields');

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

module.exports = function(service) {

  const plantuml = service.settings?.plantuml || {};

  const hasRelations = !!(plantuml.relations);

  const parseShortHand = (relation, key = "type") => {
    if (typeof relation === "string" && key === "type") return relation;
    else if (typeof relation === "string") return false;
    return relation[key];
  }

  return {
    getSchema(serviceNameMap) {
      const schema = [];
      const sourceName = serviceNameMap.get(service.fullName);
      const relationFields = fieldHandler(service?.settings?.fields).getPopulateFields();

      const getSource = (target) => {
        if (!Object.keys(relationFields).length) return false;
        console.log(relationFields)
        const [source] = Object.entries(relationFields).find(([_, value]) => value === target) || [];
        return source || false;
      }

      if (!hasRelations) return '';
      
      const relations = plantuml.relations || {};
      for (const targetService in relations) {
        const relation = parseShortHand(relations[targetService]);
        const source = parseShortHand(relations[targetService], "field") || getSource(targetService) || false;
        getSource(targetService);
        if (serviceNameMap.has(targetService)) {
          const targetName = serviceNameMap.get(targetService);

          const [left, right] = relation.split('-to-');

          schema.push(`${sourceName}${source ? `::${source}` : ''} ${leftMap[left]}${relation.includes('zero') ? '..' : '--'}${rightMap[right]} ${targetName}`)
        }
      }

      return schema.join('\n');
    },
  }
}