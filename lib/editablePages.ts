import { CONTACT, SOCIAL_LINKS } from "./site";
import type { NewsBlock } from "./newsTypes";

/**
 * Rejestr edytowalnych stron statycznych.
 * `prefill` to treść bazowa przepisana 1:1 z kodu strony - to od niej
 * zaczyna się edycję w panelu. Dopóki nic nie zapiszesz, strona pokazuje
 * oryginalny, zakodowany wygląd (fallback w EditableSection).
 */

export interface EditablePage {
  slug: string;
  label: string;
  route: string;
  /** Co dokładnie obejmuje edycja (podpowiedź w panelu). */
  scope: string;
  prefill: NewsBlock[];
}

const P = (text: string): NewsBlock => ({ type: "paragraph", text });
const H = (text: string): NewsBlock => ({ type: "heading", text });
const SH = (text: string): NewsBlock => ({ type: "subheading", text });

export const EDITABLE_PAGES: EditablePage[] = [
  {
    slug: "home",
    label: "Strona główna – tekst powitalny",
    route: "/",
    scope: "Akapity pod nagłówkiem „Witamy w krakowskim dōjō” (wideo zostaje).",
    prefill: [
      P(
        "[Shorinji Kempo](/o-shorinji/wprowadzenie) to japońska sztuka walki, w której skuteczna samoobrona idzie w parze z pracą nad charakterem. Nie chodzi w niej o pokonanie drugiego człowieka, lecz o złagodzenie cierpienia i ochronę tego, co dobre."
      ),
      P(
        "Trenujemy w trzech kierunkach naraz: samoobrony, rozwoju duchowego i zdrowia. Stąd zasada, którą powtarzamy każdemu kenshi od pierwszych zajęć, czyli „w połowie dla siebie, w połowie dla innych\". Fundamentem szkoły jest [buddyzm Kongō Zen](/buddyzm) oraz przekonanie, że ciało i umysł rozwijają się razem (Ken Zen Ichinyo)."
      ),
      P(
        "Na macie zaczynamy od podstaw, czyli kihon. Potem przechodzimy do form wykonywanych pojedynczo i w parach, a na końcu do embu i randori. Cały [program nauczania](/program-nauczania) wraz z nagraniami zebraliśmy w jednym miejscu."
      ),
      P(
        "Ćwiczymy w dwóch filiach. [Grupa dziecięca](/zajecia/dzieci) działa w filii Wawel, a [grupa dorosła](/zajecia/dorosli) w filii Kraków. Należymy do światowej organizacji Shorinji Kempo, której początek dał [So Doshin](/organizacja/zalozyciel) w 1947 roku w Japonii. To, czym żyjemy teraz, znajdziesz w [aktualnościach](/aktualnosci) oraz [galerii](/galeria)."
      ),
    ],
  },
  {
    slug: "cennik",
    label: "Cennik – tabele opłat i konto",
    route: "/cennik",
    scope: "Wszystkie tabele opłat oraz sekcja konta bankowego.",
    prefill: [
      H("Składki regularne"),
      P("Miesięczne opłaty za udział w treningach."),
      {
        type: "table",
        headers: ["Rodzaj opłaty", "Kwota"],
        rows: [
          { label: "Miesięczna opłata za trening – dzieci", price: "150 zł" },
          { label: "Miesięczna opłata za trening – dorośli", price: "160 zł" },
        ],
      },
      H("Opłaty organizacyjne"),
      P("Członkostwo w Polskiej Organizacji Shorinji Kempo."),
      {
        type: "table",
        headers: ["Rodzaj opłaty", "Kwota"],
        rows: [
          { label: "Opłata wpisowa do Organizacji", price: "50 zł" },
          { label: "Odnowienie członkostwa w Organizacji", price: "25 zł" },
          { label: "Roczna opłata członkowska", price: "10 zł" },
          { label: "Przeniesienie z jednej filii do drugiej", price: "15 zł" },
          { label: "Ustanowienie nowej filii", price: "200 zł" },
        ],
      },
      H("Egzaminy na stopnie Kyu"),
      P("Stopnie uczniowskie – od najniższego (8 Kyu) do 1 Kyu."),
      {
        type: "table",
        headers: ["Stopień", "Kwota"],
        rows: [
          { label: "8 Kyu", price: "50 zł", note: "tylko dzieci do 10. roku życia" },
          { label: "7 Kyu", price: "60 zł", note: "tylko dzieci do 10. roku życia" },
          { label: "6 Kyu", price: "70 zł" },
          { label: "5 Kyu", price: "80 zł" },
          { label: "4 Kyu", price: "90 zł" },
          { label: "3 Kyu", price: "100 zł" },
          { label: "2 Kyu", price: "110 zł" },
          { label: "1 Kyu", price: "120 zł" },
        ],
      },
      H("Egzaminy na stopnie Dan"),
      P("Stopnie mistrzowskie – od 1 Dan wzwyż."),
      {
        type: "table",
        headers: ["Stopień", "Kwota"],
        rows: [
          { label: "1 Dan", price: "200 zł" },
          { label: "2 Dan", price: "300 zł" },
          { label: "3 Dan", price: "400 zł" },
          { label: "4 Dan", price: "500 zł" },
          { label: "5 Dan / Daikenshi", price: "700 zł" },
          { label: "6 Dan / Junhanshi", price: "900 zł" },
          { label: "7 Dan / Seihanshi", price: "1500 zł" },
          { label: "8 Dan / Daihanshi", price: "3000 zł" },
        ],
      },
      H("Pozostałe opłaty"),
      P("Powtórne podejścia do egzaminów oraz duplikaty certyfikatów."),
      {
        type: "table",
        headers: ["Rodzaj opłaty", "Kwota"],
        rows: [
          { label: "Ponowne podejście do egzaminu (1 Dan – 3 Dan)", price: "50 zł" },
          { label: "Ponowne podejście do egzaminu (4 Dan albo wyżej)", price: "100 zł" },
          { label: "Ponowne wydanie certyfikatu dla stopni Kyu", price: "25 zł" },
          { label: "Ponowne wydanie certyfikatu dla stopni Dan", price: "50 zł" },
        ],
      },
      H("Konto bankowe"),
      {
        type: "callout",
        text: "**Stowarzyszenie „Polska Organizacja Shorinji Kempo\"** · ul. Wysłouchów 33/5, 30-611 Kraków · mBank: ==53 1140 2004 0000 3502 7497 1466==",
      },
      P(
        "W tytule przelewu prosimy podać imię, nazwisko oraz cel wpłaty (np. składka – kwiecień 2026, egzamin 5 Kyu)."
      ),
      P(
        "**Informacja:** opłaty miesięczne za treningi prosimy regulować z góry, do 10. dnia każdego miesiąca. Opłaty egzaminacyjne wnoszone są bezpośrednio przed egzaminem. W razie pytań dotyczących płatności zapraszamy do kontaktu – [" +
          CONTACT.email +
          "](mailto:" +
          CONTACT.email +
          ")."
      ),
    ],
  },
  {
    slug: "program-nauczania",
    label: "Program nauczania – nagrania",
    route: "/program-nauczania",
    scope: "Sekcje z linkami do nagrań (nagłówek strony zostaje).",
    prefill: [
      H("Podstawy / kihon"),
      P(
        "Pozycje, uderzenia, kopnięcia, bloki i pady (ukemi). To fundament, do którego wracamy na każdym treningu."
      ),
      {
        type: "links",
        items: [
          { label: "Jak zawiązać pas?", url: "https://www.youtube.com/watch?v=9luFLV52N_8" },
          { label: "Byakuren Hachijin", url: "https://www.youtube.com/watch?v=N_58F3VSTCs" },
          { label: "Giwa Kyujin", url: "https://www.youtube.com/watch?v=jVAFSTNBaeg" },
          { label: "Daisharin 1", url: "https://www.youtube.com/watch?v=j1BxnNqWQq8" },
          { label: "Daisharin 2", url: "https://www.youtube.com/watch?v=9ND4Rq2udis" },
          { label: "Mae Ukemi 1", url: "https://www.youtube.com/watch?v=Yjo6hWxax1Y" },
          { label: "Mae Ukemi 2", url: "https://www.youtube.com/watch?v=5Khzb_hVJ6k" },
          { label: "Ushiro Ukemi", url: "https://www.youtube.com/watch?v=b1IP0JDAmq8" },
          { label: "Ukemi po Kari Ashi", url: "https://www.youtube.com/watch?v=lcoIM2Yb6WQ" },
          { label: "Uwa Uke, Shita Uke, Jo Chu Niren Uke", url: "https://www.youtube.com/watch?v=jrPthlW2GS0" },
          { label: "Keri Age", url: "https://www.youtube.com/watch?v=XHDLXs3JIRo" },
          { label: "Kinteki Geri, Keri Age, Sokuto Geri", url: "https://www.youtube.com/watch?v=W9k8VoxA0Vc" },
        ],
      },
      H("Tan'en Kihon Hokei – formy jednoosobowe"),
      P(
        "Formy podstawowe wykonywane pojedynczo (tan'en znaczy „samemu\"). Uczą całych sekwencji technik, zanim przećwiczysz je z partnerem."
      ),
      {
        type: "links",
        items: [
          { label: "Tenchiken Dai Ikkei", url: "https://www.youtube.com/watch?v=OxkSM4L_DLc" },
          { label: "Tenchiken Dai Nikei", url: "https://www.youtube.com/watch?v=Pq-JIjllo8k" },
          { label: "Tenchiken Dai Sankei", url: "https://www.youtube.com/watch?v=0QgM-EZM8js" },
          { label: "Tenchiken Dai Yonkei", url: "https://www.youtube.com/watch?v=d478l3D6Kg0" },
          { label: "Tenchiken Dai Gokei", url: "https://www.youtube.com/watch?v=H6uya_NqW6U" },
          { label: "Tenchiken Dai Rokkei", url: "https://www.youtube.com/watch?v=ACaMYW3no4g" },
          { label: "Giwaken Dai Ikkei", url: "https://www.youtube.com/watch?v=PaFaxqM5qbk" },
          { label: "Manji-no Kata", url: "https://www.youtube.com/watch?v=0gBUjdsjO38" },
          { label: "Ryu-no Kata", url: "https://www.youtube.com/watch?v=QHkBt8zYiFM" },
        ],
      },
      H("Sotai – formy w parach"),
      P(
        "Te same formy podstawowe, ale wykonywane w parach (sotai). Dochodzi realny dystans, timing i kontakt z partnerem."
      ),
      {
        type: "links",
        items: [
          { label: "Tenchiken Dai Ikkei", url: "https://www.youtube.com/watch?v=IyKJ-IEY2fU" },
          { label: "Tenchiken Dai Nikei", url: "https://www.youtube.com/watch?v=GesgymAIyvA" },
          { label: "Giwaken Dai Ikkei", url: "https://www.youtube.com/watch?v=Odr7Af9KZa8" },
          { label: "Ryuoken Dai Ikkei", url: "https://www.youtube.com/watch?v=XjXCKDr_yc0" },
        ],
      },
    ],
  },
  {
    slug: "kontakt",
    label: "Kontakt – godziny i dane",
    route: "/kontakt",
    scope: "Sekcje „Godziny treningów” i „Dane kontaktowe” (mapa zostaje).",
    prefill: [
      H("Godziny treningów"),
      P(
        "[Grupa dziecięca](/zajecia/dzieci) trenuje we wtorki i czwartki w godzinach 18:00–19:30."
      ),
      P(
        "[Grupa dorosła](/zajecia/dorosli) trenuje we wtorki i czwartki 19:30–21:30 oraz w niedziele 18:00–21:00."
      ),
      P("Pełny plan tygodnia znajdziesz na podstronach obu grup."),
      H("Dane kontaktowe"),
      P(`**Telefon:** [${CONTACT.phoneDisplay}](tel:${CONTACT.phone})`),
      P(`**E-mail:** [${CONTACT.email}](mailto:${CONTACT.email})`),
      P(
        `**Znajdź nas w sieci:** [Facebook](${SOCIAL_LINKS.facebook}) · [Instagram](${SOCIAL_LINKS.instagram}) · [YouTube](${SOCIAL_LINKS.youtube})`
      ),
    ],
  },
  {
    slug: "zajecia-dorosli",
    label: "Zajęcia dorośli – opis treningów",
    route: "/zajecia/dorosli",
    scope:
      "Sekcja „Zajęcia dla dorosłych” (karta instruktora, plan tygodnia i mapa zostają).",
    prefill: [
      H("Zajęcia dla dorosłych"),
      P(
        "Zajęcia w filii ==Kraków== są przeznaczone dla młodzieży i dorosłych. To początek przygody młodego kenshi (ucznia szkoły Shorinji Kempo), która będzie mu towarzyszyć przez całe życie. Po okresie próbnym Mistrz kierujący filią kwalifikuje ucznia do szkoły Shorinji Kempo – każdy uczeń otrzymuje indywidualną legitymację wraz ze swoim numerem prosto z centrali Hombu w Japonii. Numer kenshi zostaje z uczniem przez całe życie – bez względu na to, gdzie jest na świecie, zawsze może trenować w każdym Dōjō."
      ),
      SH("Jak wyglądają treningi"),
      P(
        "Zajęcia składają się z ceremonii wstępnej wraz z medytacją oraz odczytaniem tekstów naszej szkoły, następnie przeprowadzona jest krótka rozgrzewka. Kolejnym etapem treningu jest praca indywidualna bez partnera nad podstawowymi ruchami i technikami (==kihon==). Następnie przechodzimy do pracy w parach – to, co przećwiczyliśmy indywidualnie, trenujemy z partnerem. Kładziemy duży nacisk na pracę w parach, ćwiczymy każdy z każdym."
      ),
      P(
        "Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające oraz korygujące postawę. Dodatkowo adepci ćwiczą formy pojedynczo i w parach. Kolejny element to ==embu== oraz ==randori==: embu to wyjątkowy układ technik wykonywany w parach z pełną szybkością i precyzją, a randori to realistyczna walka z wykorzystaniem wcześniej poznanych technik. Zajęcia prowadzą doświadczeni instruktorzy z wieloletnim stażem, finaliści mistrzostw Europy w Shorinji Kempo."
      ),
    ],
  },
  {
    slug: "zajecia-dzieci",
    label: "Zajęcia dzieci – opis treningów",
    route: "/zajecia/dzieci",
    scope:
      "Sekcja „Zajęcia dla dzieci” (karta instruktora, plan tygodnia i mapa zostają).",
    prefill: [
      H("Zajęcia dla dzieci"),
      P(
        "Zajęcia w filii ==Wawel== są przeznaczone dla dzieci i młodzieży w wieku ==5–13 lat==. To początek przygody młodego kenshi (ucznia szkoły Shorinji Kempo), która będzie mu towarzyszyć przez całe życie. Po okresie próbnym Mistrz kierujący filią kwalifikuje ucznia do szkoły Shorinji Kempo – każdy uczeń otrzymuje indywidualną legitymację wraz ze swoim numerem prosto z centrali Hombu w Japonii. To pierwsze, jakże ważne wydarzenie dla każdego kenshi! Numer kenshi zostaje z uczniem przez całe życie – bez względu na to, gdzie jest na świecie, zawsze może trenować w każdym Dōjō."
      ),
      SH("Jak wyglądają treningi"),
      P(
        "Zajęcia składają się z krótkiej ceremonii wstępnej, potem medytacji, następnie przeprowadzona jest krótka rozgrzewka. Kolejnym etapem jest praca indywidualna bez partnera nad podstawowymi ruchami i technikami (==kihon==), a następnie praca w parach – to, co przećwiczyliśmy indywidualnie, trenujemy z partnerem. Kładziemy duży nacisk na pracę w parach: ćwiczymy każdy z każdym."
      ),
      P(
        "Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające i korygujące dla prawidłowej postawy. Dodatkowo młodzi adepci ćwiczą formy pojedynczo i w parach. Zajęcia prowadzą bardzo doświadczeni instruktorzy z wieloletnim stażem, finaliści mistrzostw Europy w Shorinji Kempo."
      ),
    ],
  },
];

export function getEditablePage(slug: string): EditablePage | undefined {
  return EDITABLE_PAGES.find((p) => p.slug === slug);
}

export function routeForEditablePage(slug: string): string {
  return getEditablePage(slug)?.route ?? `/${slug}`;
}
