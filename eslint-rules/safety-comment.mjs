export default {
  meta: {
    type: 'problem',
    docs: {
      description: "Require a SAFETY: comment before calls to functions with 'unsafe' in the name",
      category: 'Best Practices',
      recommended: true,
    },
    schema: [], // no options
    messages: {
      missingSafetyComment:
        "Calls to '{{name}}' must be preceded by a comment starting with 'SAFETY:' explaining why the call is safe.",
    },
  },

  create(context) {
    const sourceCode = context.getSourceCode()

    function hasSafetyCommentOnPreviousLine(node) {
      const nodeLine = node.loc.start.line
      const comments = sourceCode.getAllComments()
      // Find a comment that ends on the line immediately above the node
      return comments.some(comment => {
        // Only allow line or block comments that start with SAFETY:
        const endsOnPrevLine = comment.loc.end.line === nodeLine - 1
        const isSafety = /^SAFETY:\s*\S+/i.test(comment.value.trim())
        return endsOnPrevLine && isSafety
      })
    }

    return {
      CallExpression(node) {
        let callee = node.callee
        let name = null

        if (callee.type === 'Identifier') {
          name = callee.name
        } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          name = callee.property.name
        }

        if (name && /unsafe/i.test(name)) {
          if (!hasSafetyCommentOnPreviousLine(node)) {
            context.report({
              node,
              messageId: 'missingSafetyComment',
              data: { name },
            })
          }
        }
      },
    }
  },
}
