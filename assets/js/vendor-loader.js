import { heicTo } from "https://esm.sh/heic-to";
  window.heicTo = heicTo;
  import * as imglyModule from "https://esm.sh/@imgly/background-removal";
  window.removeBackground = imglyModule.default || imglyModule.removeBackground || imglyModule;
