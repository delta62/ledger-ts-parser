export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer let over const except for SCREAMING_SNAKE_CASE',
      category: 'Best Practices',
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferLet: 'Use let instead of const (unless SCREAMING_SNAKE_CASE).',
    },
  },
  create(context) {
    // RegExp for SCREAMING_SNAKE_CASE
    const SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/

    return {
      VariableDeclaration(node) {
        if (node.kind === 'const') {
          // If every variable in this declaration is SCREAMING_SNAKE_CASE, allow const
          let allSnakeCase = node.declarations.every(decl => {
            return (
              decl.id.type === 'Identifier' && SNAKE_CASE.test(decl.id.name)
            )
          })
          if (allSnakeCase) return

          context.report({
            node,
            messageId: 'preferLet',
            fix(fixer) {
              let sourceCode = context.getSourceCode()
              let constToken = sourceCode.getFirstToken(node)

              if (constToken && constToken.value === 'const') {
                return fixer.replaceText(constToken, 'let')
              }

              return null
            },
          })
        }
      },
    }
  },
}
