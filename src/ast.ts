import { Group } from './group'
import { Span } from './location'
import * as parser from './parse-node'
import { unimplemented } from './util'

export type TransactionFlag = 'pending' | 'cleared'
export type CurrencyPlacement = 'pre' | 'post'
export type VirtualType = 'virtual' | 'virtual-balanced' | 'real'

export interface Visitor<T> {
  visitAccount(account: Account): T
  visitAccountDirective(directive: AccountDirective): T
  visitAliasDirective(directive: AliasDirective): T
  visitAmount(amount: Amount): T
  visitApplyAccountDirective(directive: ApplyAccountDirective): T
  visitApplyFixedDirective(directive: ApplyFixedDirective): T
  visitApplyTagDirective(directive: ApplyTagDirective): T
  visitAssertDirective(directive: AssertDirective): T
  visitBucketDirective(directive: BucketDirective): T
  visitCaptureDirective(directive: CaptureDirective): T
  visitCheckDirective(directive: CheckDirective): T
  visitCommentDirective(directive: CommentDirective): T
  visitCommodityDirective(directive: CommodityDirective): T
  visitCurrency(currency: Currency): T
  visitDefineDirective(directive: DefineDirective): T
  visitEndDirective(directive: EndDirective): T
  visitEvalDirective(directive: EvalDirective): T
  visitExprDirective(directive: ExprDirective): T
  visitIncludeDirective(directive: IncludeDirective): T
  visitPayeeDirective(directive: PayeeDirective): T
  visitPosting(posting: Posting): T
  visitRoot(root: AST): T
  visitTagDirective(directive: TagDirective): T
  visitTestDirective(directive: TestDirective): T
  visitTransaction(tx: Transaction): T
  visitYearDirective(directive: YearDirective): T
}

export abstract class ASTNode {
  constructor(public readonly span: Span) {}
  public abstract accept<T>(visitor: Visitor<T>): T
}

export type ASTChild = Transaction

export class AST extends ASTNode {
  constructor(public readonly children: ASTChild[], span: Span) {
    super(span)
  }

  public static fromNode(file: parser.File): AST {
    let children: ASTChild[] = []

    for (let child of file.children) {
      switch (child.type) {
        case 'transaction':
          children.push(Transaction.fromNode(child))
          break
        // case 'end':
        //   children.push(fromEndDirective(child))
        //   break
        // case 'commentDirective':
        //   children.push(fromCommentDirective(child))
        //   break
        // case 'comment':
        //   unimplemented('Comment nodes are not supported in the AST')
        //   break
        // case 'alias':
        //   children.push(fromAliasDirective(child))
        //   break
        // case 'apply':
        //   children.push(fromApplyDirective(child))
        //   break
        // case 'directive':
        //   children.push(fromDirective(child))
        //   break
        default:
          unimplemented(`Unknown child type: ${child.type}`)
      }
    }

    return new AST(children, file.span())
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitRoot(this)
  }
}

export class PayeeDirective extends ASTNode {
  constructor(
    public readonly name: string,
    public readonly alias: string | undefined,
    public readonly uuid: string | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitPayeeDirective(this)
  }
}

export class IncludeDirective extends ASTNode {
  constructor(public readonly path: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitIncludeDirective(this)
  }
}

export class EvalDirective extends ASTNode {
  constructor(public readonly expression: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitEvalDirective(this)
  }
}

export class ExprDirective extends ASTNode {
  constructor(public readonly expression: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitExprDirective(this)
  }
}

export class EndDirective extends ASTNode {
  constructor(public readonly isApply: boolean, public readonly name: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitEndDirective(this)
  }
}

export class CommodityDirective extends ASTNode {
  constructor(
    public readonly symbol: string,
    public readonly note: string | undefined,
    public readonly format: string | undefined,
    public readonly nomarket: boolean | undefined,
    public readonly alias: string | undefined,
    public readonly isDefault: boolean | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCommodityDirective(this)
  }
}

export class DefineDirective extends ASTNode {
  constructor(public readonly name: string, public readonly value: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitDefineDirective(this)
  }
}

export class CaptureDirective extends ASTNode {
  constructor(public readonly search: string, public readonly replace: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCaptureDirective(this)
  }
}

export class CheckDirective extends ASTNode {
  constructor(public readonly expression: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCheckDirective(this)
  }
}

export class TestDirective extends ASTNode {
  constructor(public readonly text: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitTestDirective(this)
  }
}

export class AccountDirective extends ASTNode {
  constructor(
    public readonly name: string,
    public readonly note: string | undefined,
    public readonly alias: string | undefined,
    public readonly payee: string | undefined,
    public readonly check: string | undefined,
    public readonly assert: string | undefined,
    public readonly evalu: string | undefined,
    public readonly isDefault: boolean | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAccountDirective(this)
  }
}

export class ApplyAccountDirective extends ASTNode {
  constructor(public readonly name: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyAccountDirective(this)
  }
}

export class ApplyFixedDirective extends ASTNode {
  constructor(public currency: string, public fixed: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyFixedDirective(this)
  }
}

export class AliasDirective extends ASTNode {
  constructor(public readonly name: string, public readonly alias: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAliasDirective(this)
  }
}

export class TagDirective extends ASTNode {
  constructor(
    public readonly tag: string,
    public readonly check: string | undefined,
    public readonly assert: string | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitTagDirective(this)
  }
}

export class ApplyTagDirective extends ASTNode {
  constructor(public readonly tag: string, public readonly value: string | undefined, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyTagDirective(this)
  }
}

export class YearDirective extends ASTNode {
  constructor(public readonly year: number, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitYearDirective(this)
  }
}

export class CommentDirective extends ASTNode {
  constructor(public readonly text: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCommentDirective(this)
  }
}

export class AssertDirective extends ASTNode {
  constructor(public readonly expression: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAssertDirective(this)
  }
}

export class BucketDirective extends ASTNode {
  constructor(public readonly name: string, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitBucketDirective(this)
  }
}

export class Transaction extends ASTNode {
  public static fromNode(node: parser.Transaction): Transaction {
    let date = node.date.raw.innerText()
    let auxDate = node.auxDate?.date?.raw.innerText()
    let flag: TransactionFlag | undefined = node.cleared ? 'cleared' : node.pending ? 'pending' : undefined
    let payee = node.payee?.group.innerText()
    let postings: Posting[] = node.postings.map(Posting.fromNode)

    return new Transaction(date, auxDate, flag, payee, postings, node.span())
  }

  constructor(
    public readonly date: string,
    public readonly auxDate: string | undefined,
    public readonly flag: TransactionFlag | undefined,
    public readonly payee: string | undefined,
    public readonly postings: Posting[],
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitTransaction(this)
  }
}

export class Posting extends ASTNode {
  public static fromNode(node: parser.Posting): Posting {
    let account = Account.fromNode(node.account)
    let amount = node.amount ? Amount.fromNode(node.amount) : undefined
    let comment: string | undefined = undefined
    let flag: TransactionFlag | undefined = undefined

    return new Posting(account, amount, comment, flag, node.span())
  }

  constructor(
    public readonly account: Account,
    public readonly amount: Amount | undefined,
    public readonly comment: string | undefined,
    public readonly flag: TransactionFlag | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitPosting(this)
  }
}

export class Amount extends ASTNode {
  public static fromNode(node: parser.Amount): Amount {
    let volume = parseFloat(node.amount.innerText())
    let precision = (node.amount.innerText().match(/\.\d+$/) ?? ['', ''])[1].length
    let currency: Currency | undefined = undefined

    if (node.preCommodity) {
      currency = Currency.fromNodePrefix(node.preCommodity)
    } else if (node.postCommodity) {
      currency = Currency.fromNodePostfix(node.postCommodity)
    }

    return new Amount(volume, precision, currency, node.span())
  }

  constructor(
    public readonly volume: number,
    public readonly precision: number,
    public readonly currency: Currency | undefined,
    span: Span
  ) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAmount(this)
  }
}

export class Currency extends ASTNode {
  public static fromNodePrefix(node: Group): Currency {
    return new Currency(node.innerText(), 'pre', node.span())
  }

  public static fromNodePostfix(node: Group): Currency {
    return new Currency(node.innerText(), 'post', node.span())
  }

  constructor(public readonly symbol: string, public readonly placement: CurrencyPlacement, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCurrency(this)
  }
}

class Account extends ASTNode {
  public static fromNode(node: parser.AccountRef): Account {
    let nameField = node.name
    let name: string
    let virtualType: VirtualType

    if (nameField instanceof parser.SurroundedBy) {
      name = nameField.contents.innerText()
      virtualType = nameField.open.type === 'lparen' ? 'virtual' : 'virtual-balanced'
    } else {
      name = nameField.innerText()
      virtualType = 'real'
    }

    return new Account(name, virtualType, node.span())
  }

  constructor(public readonly name: string, public readonly virtualType: VirtualType, span: Span) {
    super(span)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAccount(this)
  }
}
