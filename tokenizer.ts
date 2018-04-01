type INTEGER_STRING = string | number;

const ZERO = 48;
const SEVEN = 55;
const NINE = 57;

const DOT = 46;
const DASH = 45;
const TAB = 9;
const SLASH = 47;

const CR = 13;
const EOL = 10;


export class StreamTokenizer {

  private buf = new Array(20);

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
  public static TT_EOL = EOL;
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

  /** Read the next character */
  private read(): number {
    return this._input.charCodeAt(this.index++);
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
      if (isNaN(c)) {
        return this.ttype = StreamTokenizer.TT_EOF;
      }
      if (c == EOL) {
        c = StreamTokenizer.NEED_CHAR;
      }
    }
    if (c == StreamTokenizer.NEED_CHAR) {
      c = this.read();
      if (isNaN(c)){
        return this.ttype = StreamTokenizer.TT_EOF;
      }
    }
    this.ttype = c;
    /* Just to be safe */
    /* Set peekc so that the next invocation of nextToken will read
     * another character unless peekc is reset in this invocation
     */
    this.peekc = StreamTokenizer.NEED_CHAR;

    let ctype = c < 256 ? ct[c] : StreamTokenizer.CT_ALPHA;
    while ((ctype & StreamTokenizer.CT_WHITESPACE) != 0) {
      if (c == CR) {
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
        /* Do one division of a likely-to-be-more-accurate number */
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
      this.sval = this.buf.slice(0, i).join(""); //String.copyValueOf(buf, 0, i);
      if (this.forceLower) {
        this.sval = this.sval.toLowerCase();
      }
      return this.ttype = StreamTokenizer.TT_WORD;
    }

    if ((ctype & StreamTokenizer.CT_QUOTE) != 0) {
      this.ttype = c;
      let i = 0;
      /* Invariants (because \Octal needs a lookahead):
       *   (i)  c contains char value
       *   (ii) d contains the lookahead
       */
      let d = this.read();
      while (d >= 0 && d != this.ttype && d != EOL && d != CR) {
        if (d == "\\".charCodeAt(0)) {
          c = this.read();
          let first = c;
          /* To allow \377, but not \477 */
          if (c >= ZERO && c <= SEVEN) {
            c = c - ZERO;
            let c2 = this.read();
            if (ZERO <= c2 && c2 <= SEVEN) {
              c = (c << 3) + (c2 - ZERO);
              c2 = this.read();
              if (ZERO <= c2 && c2 <= SEVEN && first <= "3".charCodeAt(0)) {
                c = (c << 3) + (c2 - ZERO);
                d = this.read();
              } else
                d = c2;
            } else
              d = c2;
          } else {
            switch (c) {
              case "a".charCodeAt(0):
                c = 0x7;
                break;
              case "b".charCodeAt(0):
                c = "\b".charCodeAt(0);
                break;
              case "f".charCodeAt(0):
                c = 0xC;
                break;
              case "n".charCodeAt(0):
                c = EOL;
                break;
              case "r".charCodeAt(0):
                c = CR;
                break;
              case "t".charCodeAt(0):
                c = TAB;
                break;
              case "v".charCodeAt(0):
                c = 0xB;
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

      this.sval = this.buf.slice(0, i).join(""); //String.copyValueOf(buf, 0, i);
      return this.ttype;
    }

    if (c == SLASH && (this.slashSlashCommentsP || this.slashStarCommentsP)) {
      c = this.read();
      if (c == "*".charCodeAt(0) && this.slashStarCommentsP) {
        let prevc = 0;
        while ((c = this.read()) != SLASH || prevc != "*".charCodeAt(0)) {
          if (c == CR) {
            this.LINENO++;
            c = this.read();
            if (c == EOL) {
              c = this.read();
            }
          } else {
            if (c == EOL) {
              this.LINENO++;
              c = this.read();
            }
          }
          if (isNaN(c))
            return this.ttype = StreamTokenizer.TT_EOF;
          prevc = c;
        }
        return this.nextToken();
      } else if (c == SLASH && this.slashSlashCommentsP) {
        while ((c = this.read()) != EOL && c != CR && c >= 0) ;
        this.peekc = c;
        return this.nextToken();
      } else {

        if ((ct["/"] & StreamTokenizer.CT_COMMENT) != 0) {
          while ((c = this.read()) != EOL && c != CR && c >= 0) ;
          this.peekc = c;
          return this.nextToken();
        } else {
          this.peekc = c;
          return this.ttype = SLASH;
        }
      }
    }

    if ((ctype & StreamTokenizer.CT_COMMENT) != 0) {
      while ((c = this.read()) != EOL && c != CR && c >= 0) ;
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

        ret = "'";
        ret += String.fromCharCode(this.ttype);
        ret += "'";
        break;
      }
    }
    return "Token[" + ret + "], line " + this.LINENO;
  }

}