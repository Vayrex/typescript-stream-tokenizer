type INTEGER_STRING = string | number;

const ZERO = 48;
const THREE = 51;
const SEVEN = 55;
const NINE = 57;

const CHAR_a = 97;
const CHAR_b = 98;
const CHAR_f = 102;
const CHAR_n = 110;
const CHAR_r = 114;
const CHAR_t = 116;
const CHAR_v = 118;

const ASTERISK = 42;
const DASH = 45;
const DOT = 46;
const SLASH = 47;
const BACK_SLASH = 92;

const ALERT = 7;
const BACKSPACE = 8;
const HORIZONTAL_TAB = 9;
const NEW_LINE = 10;
const VERTCAL_TAB = 11;
const FORM_FEED = 12
const CARRIAGE_RETURN = 13;


export class StreamTokenizer {

  public buf = new Array();

  /************************************************************************************/
  private peekc = StreamTokenizer.NEED_CHAR;

  private static NEED_CHAR = Number.MAX_SAFE_INTEGER;
  private static SKIP_LF = Number.MAX_SAFE_INTEGER - 1;
  /************************************************************************************/

  private pushedBack: boolean;
  private forceLower: boolean;
  private LINENO = 1;

  private eolIsSignificantP = false;
  private slashSlashCommentsP = false;
  private slashStarCommentsP = false;
  /************************************************************************************/

  private ctype = new Uint8Array(new ArrayBuffer(256));

  private static CT_WHITESPACE = 1;
  private static CT_DIGIT = 2;
  private static CT_ALPHA = 4;
  private static CT_QUOTE = 8;
  private static CT_COMMENT = 16;

  /************************************************************************************/

  public ttype = StreamTokenizer.TT_NOTHING;

  public static TT_EOF = -1;
  public static TT_EOL = NEW_LINE;
  public static TT_NUMBER = -2;
  public static TT_WORD = -3;
  public static TT_NOTHING = -4;
  /************************************************************************************/

  public sval: string;
  public nval: number;

  private index = 0;

  constructor(private _input:string) {

  }

  public setDefaultSyntax(){
    this.wordChars("a", "z");
    this.wordChars("A", "Z");
    this.wordChars(128 + 32, 255);
    this.whitespaceChars(0, " ");
    this.commentChar("/");
    this.quoteChar("\"");
    this.quoteChar("'");
    this.parseNumbers();
  }

  public resetSyntax(): void {
    for (let i = this.ctype.length; --i >= 0;) {
      this.ctype[i] = 0;
    }
  }

  private ensureInteger(v: INTEGER_STRING) {
    if ("string" == typeof v) {
      v = v.charCodeAt(0);
    }
    return v;
  }

  public wordChars(low: INTEGER_STRING, hi: INTEGER_STRING): void {

    low = this.ensureInteger(low);
    hi = this.ensureInteger(hi);

    if (low < 0) {
      low = 0;
    }

    if (hi >= this.ctype.length) {
      hi = this.ctype.length - 1;
    }

    while (low <= hi) {
      this.ctype[low++] |= StreamTokenizer.CT_ALPHA;
    }
  }

  public whitespaceChars(low: INTEGER_STRING, hi: INTEGER_STRING): void {

    low = this.ensureInteger(low);
    hi = this.ensureInteger(hi);

    if (low < 0) {
      low = 0;
    }

    if (hi >= this.ctype.length) {
      hi = this.ctype.length - 1;
    }

    while (low <= hi) {
      this.ctype[low++] = StreamTokenizer.CT_WHITESPACE;
    }
  }

  public ordinaryChars(low: INTEGER_STRING, hi: INTEGER_STRING): void {

    low = this.ensureInteger(low);
    hi = this.ensureInteger(hi);

    if (low < 0) {
      low = 0;
    }

    if (hi >= this.ctype.length) {
      hi = this.ctype.length - 1;
    }

    while (low <= hi) {
      this.ctype[low++] = 0;
    }
  }

  public ordinaryChar(ch: INTEGER_STRING): void {
    ch = this.ensureInteger(ch);
    if (ch >= 0 && ch < this.ctype.length) {
      this.ctype[ch] = 0;
    }
  }

  public commentChar(ch: INTEGER_STRING): void {
    ch = this.ensureInteger(ch);
    if (ch >= 0 && ch < this.ctype.length) {
      this.ctype[ch] = StreamTokenizer.CT_COMMENT;
    }
  }

  public quoteChar(ch: INTEGER_STRING): void {
    ch = this.ensureInteger(ch);
    if (ch >= 0 && ch < this.ctype.length) {
      this.ctype[ch] = StreamTokenizer.CT_QUOTE;
    }
  }

  public parseNumbers(): void {
    for (let i = 0; i <= 9; i++) {
      let j = i.toString().charCodeAt(0);
      this.ctype[j] |= StreamTokenizer.CT_DIGIT;
    }
    this.ctype[DOT] |= StreamTokenizer.CT_DIGIT;
    this.ctype[DASH] |= StreamTokenizer.CT_DIGIT;
  }

  /**********************************************************************************************/
  public eolIsSignificant(flag: boolean): void {
    this.eolIsSignificantP = flag;
  }


  public slashStarComments(flag: boolean): void {
    this.slashStarCommentsP = flag;
  }


  public slashSlashComments(flag: boolean) {
    this.slashSlashCommentsP = flag;
  }

  public lowerCaseMode(fl: boolean) {
    this.forceLower = fl;
  }

  private read(): number {
    let i = this._input.charCodeAt(this.index++);
    return isNaN(i) ? -1 : i;
  }

  public nextToken(): number {
    if (this.pushedBack) {
      this.pushedBack = false;
      return this.ttype;
    }

    let ct = this.ctype;
    this.sval = null;

    let c = this.peekc;
    if (c < 0)
      c = StreamTokenizer.NEED_CHAR;
    if (c == StreamTokenizer.SKIP_LF) {
      c = this.read();
      if (c < 0) {
        return this.ttype = StreamTokenizer.TT_EOF;
      }
      if (c == NEW_LINE) {
        c = StreamTokenizer.NEED_CHAR;
      }
    }
    if (c == StreamTokenizer.NEED_CHAR) {
      c = this.read();
      if (c < 0){
        return this.ttype = StreamTokenizer.TT_EOF;
      }
    }
    this.ttype = c;
    this.peekc = StreamTokenizer.NEED_CHAR;

    let ctype = c < 256 ? ct[c] : StreamTokenizer.CT_ALPHA;
    while ((ctype & StreamTokenizer.CT_WHITESPACE) != 0) {
      if (c == CARRIAGE_RETURN) {
        this.LINENO++;
        if (this.eolIsSignificantP) {
          this.peekc = StreamTokenizer.SKIP_LF;
          return this.ttype = StreamTokenizer.TT_EOL;
        }
        c = this.read();
        if (c == StreamTokenizer.TT_EOL)
          c = this.read();
      } else {
        if (c == StreamTokenizer.TT_EOL) {
          this.LINENO++;
          if (this.eolIsSignificantP) {
            return this.ttype = StreamTokenizer.TT_EOL;
          }
        }
        c = this.read();
      }
      if (c < 0) {
        return this.ttype = StreamTokenizer.TT_EOL;
      }
      ctype = c < 256 ? ct[c] : StreamTokenizer.CT_ALPHA;
    }

    if ((ctype & StreamTokenizer.CT_DIGIT) != 0) {
      let neg = false;
      if (c == DASH) {
        c = this.read();
        if (c != DOT && (c < ZERO || c > NINE)) {
          this.peekc = c;
          return this.ttype = DASH;
        }
        neg = true;
      }
      let v = 0,
        decexp = 0,
        seendot = 0;
      while (true) {
        if (c == DOT && seendot == 0){
          seendot = 1;
        }
        else if (ZERO <= c && c <= NINE) {
          v = v * 10 + (c - ZERO);
          decexp += seendot;
        } else{
          break;
        }
        c = this.read();
      }
      this.peekc = c;
      if (decexp != 0) {
        let denom = 10;
        decexp--;
        while (decexp > 0) {
          denom *= 10;
          decexp--;
        }
        v = v / denom;
      }
      this.nval = neg ? -v : v;
      return this.ttype = StreamTokenizer.TT_NUMBER;
    }

    if ((ctype & StreamTokenizer.CT_ALPHA) != 0) {
      let i = 0;
      do {
        this.buf[i++] = String.fromCharCode(c);
        c = this.read();
        ctype = c < 0 ? StreamTokenizer.CT_WHITESPACE : c < 256 ? ct[c] : StreamTokenizer.CT_ALPHA;
      } while ((ctype & (StreamTokenizer.CT_ALPHA | StreamTokenizer.CT_DIGIT)) != 0);
      this.peekc = c;
      this.sval = this.buf.slice(0, i).join("");
      if (this.forceLower) {
        this.sval = this.sval.toLowerCase();
      }
      return this.ttype = StreamTokenizer.TT_WORD;
    }

    if ((ctype & StreamTokenizer.CT_QUOTE) != 0) {
      this.ttype = c;
      let i = 0;

      let d = this.read();
      while (d >= 0 && d != this.ttype && d != NEW_LINE && d != CARRIAGE_RETURN) {
        if (d == BACK_SLASH) {
          c = this.read();
          let first = c;

          if (c >= ZERO && c <= SEVEN) {
            c = c - ZERO;
            let c2 = this.read();
            if (ZERO <= c2 && c2 <= SEVEN) {
              c = (c << 3) + (c2 - ZERO);
              c2 = this.read();
              if (ZERO <= c2 && c2 <= SEVEN && first <= THREE) {
                c = (c << 3) + (c2 - ZERO);
                d = this.read();
              } else
                d = c2;
            } else
              d = c2;
          } else {
            switch (c) {
              case CHAR_a:
                c = ALERT;
                break;
              case CHAR_b:
                c = BACKSPACE;
                break;
              case CHAR_f:
                c = FORM_FEED;
                break;
              case CHAR_n:
                c = NEW_LINE;
                break;
              case CHAR_r:
                c = CARRIAGE_RETURN;
                break;
              case CHAR_t:
                c = HORIZONTAL_TAB;
                break;
              case CHAR_v:
                c = VERTCAL_TAB;
                break;
            }
            d = this.read();
          }
        } else {
          c = d;
          d = this.read();
        }
        this.buf[i++] = String.fromCharCode(c);
      }

      this.peekc = (d == this.ttype) ? StreamTokenizer.NEED_CHAR : d;

      this.sval = this.buf.slice(0, i).join("");
      return this.ttype;
    }

    if (c == SLASH && (this.slashSlashCommentsP || this.slashStarCommentsP)) {
      c = this.read();
      if (c == ASTERISK && this.slashStarCommentsP) {
        let prevc = 0;
        while ((c = this.read()) != SLASH || prevc != ASTERISK) {
          if (c == CARRIAGE_RETURN) {
            this.LINENO++;
            c = this.read();
            if (c == NEW_LINE) {
              c = this.read();
            }
          } else {
            if (c == NEW_LINE) {
              this.LINENO++;
              c = this.read();
            }
          }
          if (c < 0)
            return this.ttype = StreamTokenizer.TT_EOF;
          prevc = c;
        }
        return this.nextToken();
      } else if (c == SLASH && this.slashSlashCommentsP) {
        while ((c = this.read()) != NEW_LINE && c != CARRIAGE_RETURN && c >= 0) ;
        this.peekc = c;
        return this.nextToken();
      } else {
        if ((ct["/"] & StreamTokenizer.CT_COMMENT) != 0) {
          while ((c = this.read()) != NEW_LINE && c != CARRIAGE_RETURN && c >= 0) ;
          this.peekc = c;
          return this.nextToken();
        } else {
          this.peekc = c;
          return this.ttype = SLASH;
        }
      }
    }

    if ((ctype & StreamTokenizer.CT_COMMENT) != 0) {
      while ((c = this.read()) != NEW_LINE && c != CARRIAGE_RETURN && c >= 0) ;
      this.peekc = c;
      return this.nextToken();
    }

    return this.ttype = c;
  }

  public pushBack(): void {
    if (this.ttype != StreamTokenizer.TT_NOTHING) {
      this.pushedBack = true;
    }
  }

  public lineno(): number {
    return this.LINENO;
  }

  public toString(): string {
    let ret: string;
    switch (this.ttype) {
      case StreamTokenizer.TT_EOF:
        ret = "EOF";
        break;
      case StreamTokenizer.TT_EOL:
        ret = "EOL";
        break;
      case StreamTokenizer.TT_WORD:
        ret = this.sval;
        break;
      case StreamTokenizer.TT_NUMBER:
        ret = "n=" + this.nval;
        break;
      case StreamTokenizer.TT_NOTHING:
        ret = "NOTHING";
        break;
      default: {
        if (this.ttype < 256 &&
          ((this.ctype[this.ttype] & StreamTokenizer.CT_QUOTE) != 0)) {
          ret = this.sval;
          break;
        }
        ret = String.fromCharCode(this.ttype);
        break;
      }
    }

    return "Token['" + ret + "'], line " + this.LINENO;
  }
}