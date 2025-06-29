import { Location } from './location'

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

export interface Span {
  start: Readonly<Location>
  end: Readonly<Location>
}

export abstract class ASTNode {
  private _span: Readonly<Span>

  constructor(start: Readonly<Location>, end: Readonly<Location>) {
    this._span = { start, end }
  }

  public abstract accept<T>(visitor: Visitor<T>): T

  public get span(): Readonly<Span> {
    return this._span
  }
}

export type ASTChild = Transaction

export class AST extends ASTNode {
  constructor(public readonly children: ASTChild[], start: Location, end: Location) {
    super(start, end)
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
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitPayeeDirective(this)
  }
}

export class IncludeDirective extends ASTNode {
  constructor(public readonly path: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitIncludeDirective(this)
  }
}

export class EvalDirective extends ASTNode {
  constructor(public readonly expression: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitEvalDirective(this)
  }
}

export class ExprDirective extends ASTNode {
  constructor(public readonly expression: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitExprDirective(this)
  }
}

export class EndDirective extends ASTNode {
  constructor(public readonly isApply: boolean, public readonly name: string, start: Location, end: Location) {
    super(start, end)
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
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCommodityDirective(this)
  }
}

export class DefineDirective extends ASTNode {
  constructor(public readonly name: string, public readonly value: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitDefineDirective(this)
  }
}

export class CaptureDirective extends ASTNode {
  constructor(public readonly search: string, public readonly replace: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCaptureDirective(this)
  }
}

export class CheckDirective extends ASTNode {
  constructor(public readonly expression: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCheckDirective(this)
  }
}

export class TestDirective extends ASTNode {
  constructor(public readonly text: string, start: Location, end: Location) {
    super(start, end)
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
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAccountDirective(this)
  }
}

export class ApplyAccountDirective extends ASTNode {
  constructor(public readonly name: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyAccountDirective(this)
  }
}

export class ApplyFixedDirective extends ASTNode {
  constructor(public currency: string, public fixed: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyFixedDirective(this)
  }
}

export class AliasDirective extends ASTNode {
  constructor(public readonly name: string, public readonly alias: string, start: Location, end: Location) {
    super(start, end)
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
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitTagDirective(this)
  }
}

export class ApplyTagDirective extends ASTNode {
  constructor(public readonly tag: string, public readonly value: string | undefined, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitApplyTagDirective(this)
  }
}

export class YearDirective extends ASTNode {
  constructor(public readonly year: number, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitYearDirective(this)
  }
}

export class CommentDirective extends ASTNode {
  constructor(public readonly text: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCommentDirective(this)
  }
}

export class AssertDirective extends ASTNode {
  constructor(public readonly expression: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAssertDirective(this)
  }
}

export class BucketDirective extends ASTNode {
  constructor(public readonly name: string, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitBucketDirective(this)
  }
}

export class Transaction extends ASTNode {
  constructor(
    public readonly date: string,
    public readonly payee: string,
    public readonly postings: Posting[],
    public readonly flag: TransactionFlag | undefined,
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitTransaction(this)
  }
}

export class Posting extends ASTNode {
  constructor(
    public readonly account: Account,
    public readonly amount: Amount,
    public readonly comment: string | undefined,
    public readonly flag: TransactionFlag | undefined,
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitPosting(this)
  }
}

export class Amount extends ASTNode {
  constructor(
    public readonly volume: number,
    public readonly currency: Currency | undefined,
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAmount(this)
  }
}

export class Currency extends ASTNode {
  constructor(
    public readonly symbol: string,
    public readonly placement: CurrencyPlacement,
    start: Location,
    end: Location
  ) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitCurrency(this)
  }
}

class Account extends ASTNode {
  constructor(public readonly name: string, public readonly virtualType: VirtualType, start: Location, end: Location) {
    super(start, end)
  }

  public accept<T>(visitor: Visitor<T>): T {
    return visitor.visitAccount(this)
  }
}
