var displayParagraphs = require('./display-paragraphs')
var escape = require('./escape')
var html = require('./html')
var latest = require('../latest')

var footer = require('./partials/footer')
var head = require('./partials/head')
var header = require('./partials/header')
var nav = require('./partials/nav')

var legalTool = latest(require('pdc-legal-tool'))

var JOURNALS = require('synthetic-biology-journals').sort()
var PRECHECKED_JOURNALS = [
  'ACS Synthetic Biology',
  'IET Synthetic Biology',
  'International Journal of Systems and Synthetic Biology',
  'Journal of Synthetic Biology',
  'Systems and Synthetic Biology'
]

var CATEGORY_ORDER = [
  'composition of matter', 'process', 'machine', 'manufacture'
]
var CATEGORIES = require('us-patent-categories')
  .sort(function (a, b) {
    return CATEGORY_ORDER.indexOf(a.term) - CATEGORY_ORDER.indexOf(b.term)
  })

var SUBJECTS = require('nature-subjects').sort(function (a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase())
})

var SEQUENCE_ACCEPT = []
  .concat([
    '.fasta',
    '.fna',
    '.ffn',
    '.faa',
    '.frn',
    'chemical/fasta',
    'chemical/seq-aa-fasta',
    'chemical/seq-na-fasta'
  ])
  .concat([
    '.gb',
    '.gbk',
    '.genbank',
    'chemical/genbank',
    'chemical/seq-na-genbank'
  ])
  .join(',')

// TODO: search interface to find related contributions by submitter name

module.exports = function (configuration, errors, values) {
  return html`
<!doctype html>
<html lang=en>
  ${head(configuration, 'Publish')}
  <body>
    <div class=wrapper>
    ${header()}
    ${nav()}

    <main>
      <p>
        Use this form to contribute findings in synthetic biology
        to the public domain by publishing them to the Public Domain Chronicle.
        For more about PDC, see
        <a
            href=https://publicdomainchronicle.org
            target=_blank
          >Public Domain Chronicle</a>.
      </p>

      <aside class=legal>
        Do not break the law, any institutional policy, or any contract
        by publishing in PDC.
        See
        <a
            target=_blank
            href=https://publicdomainchronicle.org/contribute
          >PDC&rsquo;s contributor guide</a>
        for more information.
      </aside>

      ${errors && html`
        <p class=bad>The submitted publication had invalid input.</p>
      `}

      <form method=post action=publish enctype=multipart/form-data>
        <input type=hidden name=version value=1.0.0>

        <section id=contributor>
          <h1>Contributor</h1>

          <aside class=legal>
            To publish in PDC, you must grant a public copyright
            license for your submission.  Usually, the one who writes
            the materials is the one who has to give the license.
            The answers to this form, especially the title, finding,
            and any attachments, should be your own work.
          </aside>

          <section id=name class=optional>
            <h2>Name</h2>

            <p>Please provide your full name.</p>

            <p>
              If you want to publish to PDC anonymously, leave this
              field blank.
            </p>

            <input
              name=name
              type=text
              value="${value('name')}"
              autocomplete=name>
          </section>

          <section id=affiliation class=optional>
            <h2>Affiliation</h2>

            <p>
              Please provide the legal name of your commercial, academic,
              nonprofit, governmental, or other organization, if any.
            </p>

            <p>
              If you want to publish to PDC anonymously, leave this
              field blank.
            </p>

            <input name=affiliation type=text autocomplete=organization>
          </section>
        </section>

        <section class=required id=title>
          <h2>Title</h2>

          <p>
            Provide a title for your submission, describing what you've
            found and how it is useful, in the terms most natural for
            you and fellow synthetic biologists.
          </p>

          <input name=title type=text maxlength=256 spellcheck required>
        </section>

        <section id=finding class=required>
          <h2>Finding</h2>

          <p>
            Describe what you&rsquo;ve found. Feel free to put it just
            as you would to a colleague in your field, to make clear to
            them what&rsquo;s new, and how it&rsquo;s useful.
            Use multiple paragraphs if necessary.
          </p>

          <aside class=legal>
            This is the most important part.  If your description
            enables other synthetic biologists to make and use what you've
            found, publishing it helps secure it for the public domain.
            If at all possible, have a colleague review your description
            and tell you if it&rsquo;s missing anything that isn&rsquo;t
            obvious.
          </aside>

          <textarea
              name=finding
              rows=15
              maxlength=28000
              spellcheck
              required>${value('description')}</textarea>
        </section>

        <section id=safety class=optional>
          <h2>Safety Notes</h2>

          <p>
            Describe any safety precaution that you are taking,
            as well as precautions others might like to take when
            trying and using your finding or the materials involved.
          </p>

          <aside class=legal>
            If your finding implicates Biosafety Level 4, please
            seriously reconsider sharing your finding via PDC.
            PDC publications are published instantly, distributed
            globally, and free to redistribute.
          </aside>

          <textarea name=safety rows=5 spellcheck></textarea>
        </section>

        ${sequencesSection(values)}

        <section id=attachments class=optional>
          <h1>Other Files</h1>

          <p>
            If other data files help describe your
            finding or how to use it, attach them here.
            Please <em>don&rsquo;t</em> attach a preprint PDF or article.
            Those best belong on a preprint server, like
            <a href=http://biorxiv.org target=_blank>bioR&chi;iv</a>,
            under a <a href=https://creativecommons.org>Creative Commons</a>
            license.
          </p>

          <aside class=legal>
            Consider publishing computer code, data files,
            and other technical work to a public repository
            like <a href=https://github.com>GitHub</a> under an <a
            href=https://opensource.org/licenses>open source software</a>,
            <a href=https://opendatacommons.org/licenses>open data</a>,
            or similar license.
          </aside>

          <ul class=inputs>
            ${html`
              <li><input name=attachments[] type=file></li>
            `.repeat(3)}
          </ul>
        </section>

        <section id=metadata>
          <h1>Metadata</h1>

          <p>
            &ldquo;Metadata&rdquo;, or data about data, help researchers
            and computer programs catalog, index, and search digital
            records like your publication.  Taking a few seconds to add
            metadata to your publication transforms it from a needle in
            a haystack into a useful record for reseachers.
          </p>

          <section id=ussubjectmatter class=recommended>
            <h2>Subject Matter Category</h2>

            <p>
              Which of the follow best describes your contribution?
              Usually, only one should match.  Choose the closest.
            </p>

            <ul class=shortListOfCheckBoxes>
              ${CATEGORIES.map(function (category) {
    return html`
                <li>
                  <label>
                    <input
                        name=ussubjectmatter[]
                        type=checkbox
                        value="${escape(category.term)}">
                    ${escape(category.term)}
                    ${category.aka && (
    '(or ' +
                      category.aka
                        .map(function (term) {
                          return escape('"' + term + '"')
                        })
                        .join(', ') +
                      ')'
  )}
                    ${
  category.term === 'composition of matter' &&
                      '(<em>most common</em>)'
}
                    ${
  (
    category.term === 'manufacture' ||
                        category.term === 'machine'
  ) &&
                      '(<em>uncommon</em>)'
}
                    &mdash;
                    ${escape(category.definition)}
                  </label>
                </li>
                `
  })}
            </ul>
          </section>

          <section id=naturesubjects class=recommended>
            <h2>Subject Keywords</h2>

            <p>
              Which of the following subject keywords describe the area of your
              contribution? Usually, three or four are enough.
            </p>

            <ul class=listOfCheckBoxes>
              ${SUBJECTS.map(function (subject) {
    return html`
                <li>
                  <label>
                    <input
                        name=naturesubjects[]
                        type=checkbox
                        value="${escape(subject.toLowerCase())}">
                    ${escape(subject)}
                  </label>
                </li>
                `
  })}
            </ul>
          </section>

          <section id=journals class=recommended>
            <h2>Journals</h2>

            <p>
              Which journals do others interested in the area of your
              contribution publish in and read?  Tick the boxes next to
              the journals most relevant to your contribution.
              A few general-area synthetic biology journals have been
              checked for you.
            </p>

            <ul class=listOfCheckBoxes>
              ${JOURNALS.map(function (journal) {
    return html`
                <li>
                  <label>
                    <input
                        name=journals[]
                        type=checkbox
                        value="${escape(journal)}"
                        ${PRECHECKED_JOURNALS.includes(journal) && 'checked'}>
                    ${escape(journal)}
                  </label>
                </li>
                `
  })}
            </ul>
          </section>

          <section id=classifications class=optional>
            <h2>Patent Classifications</h2>

            <p>
              The
              <a href=http://web2.wipo.int/classifications/ipc/ipcpub
                >International Patent Classification</a>
              is a standardized taxonomy of technologies, referred to by codes.
              For example,
              <a href=http://web2.wipo.int/classifications/ipc/ipcpub?notion=scheme&version=20170101&symbol=C12N0009000000&menulang=en&lang=en&viewmode=m&fipcpc=no&showdeleted=yes&indexes=no&headings=yes&notes=yes&direction=o2n&initial=A&cwid=none&tree=no&searchmode=smart
                ><code>C12N 0/900</code></a>
              denotes
              <a href=https://en.wikipedia.org/wiki/Oxidoreductase>oxidoreductases</a>.
            </p>

            <p>
              If you&rsquo;re familiar with IPCs from prior patents,
              please identify them below.  Otherwise, feel free to skip
              this section.
            </p>

            <ul class=inputs>
              ${html`
                <li>
                  <input
                      name=ipcs[]
                      type=text
                      placeholder="IPC Code">
                </li>
              `.repeat(3)}
            </ul>
          </section>

          <section id=links class=optional>
            <h2>Other PDC Publications</h2>

            <p>
              If your contribution builds from or refers to previous PDC
              publications, copy their cryptographic digests into the
              boxes below.
            </p>

            <ul class=inputs>
              ${html`
                <li>
                  <input
                      name=links[]
                      type=text
                      pattern="^[abcdef0-9]{64}$"
                      placeholder="SHA-256 digest">
                </li>
              `.repeat(3)}
            </ul>
          </section>
        </section>

        <section id=legal class=required>
          <h2>${escape(legalTool.title)}</h2>
          <p class=version>Version ${escape(legalTool.version)}</p>
          ${displayParagraphs(legalTool.paragraphs)}
          <label>
            <input
                name=legal
                type=checkbox
                value="${escape(legalTool.version)}"
                required>
            Check this box to apply the legal tool to your submission.
          </label>
        </section>

        ${configuration.feedback && html`
        <section id=feedback class=optional>
          <h2>Feedback</h2>
          <p>
            How could we make this form easier to use?
          </p>
          <textarea name=feedback rows=5></textarea>
        </section>
        `}

        <section id=submit>
          <h2>Publish</h2>

          <p>
            Submittions to PDC are published instantly, publicly, and
            permanently.  Please take a moment to review your responses.
          </p>

          <div class=g-recaptcha data-sitekey="${configuration.recaptcha.public}"></div>
          <noscript>
            <div>
              <div style="width: 302px; height: 422px; position: relative;">
                <div style="width: 302px; height: 422px; position: absolute;">
                  <iframe
                      src="https://www.google.com/recaptcha/api/fallback?k=${configuration.recaptcha.public}"
                      frameborder=0
                      scrolling=no
                      style="width: 302px; height:422px; border-style: none;">
                  </iframe>
                </div>
              </div>
              <div
                style="width: 300px; height: 60px; border-style: none; bottom: 12px; left: 25px; margin: 0px; padding: 0px; right: 25px; background: #f9f9f9; border: 1px solid #c1c1c1; border-radius: 3px;">
                <textarea
                    id=g-recaptcha-response
                    name=g-recaptcha-response
                    class=g-recaptcha-response
                    style="width: 250px; height: 40px; border: 1px solid #c1c1c1; margin: 10px 25px; padding: 0px; resize: none;"
                ></textarea>
              </div>
            </div>
          </noscript>

          <input type=submit value="Publish to PDC">
        </section>
      </form>
    </main>
    </div>

    ${footer()}

    <script src=publish.js></script>
    <script src=https://www.google.com/recaptcha/api.js></script>
  </body>
</html>
  `

  function value (key) {
    return (values && values[key]) ? escape(values[key]) : ''
  }
}

function sequencesSection (values) {
  if (values && values.sequences) {
    return html`
<section id=sequences class=optional>
  <h1>Sequences</h1>
  ${values.sequences.map(function (sequence) {
    return html`
      <textarea class=sequence name=sequences[]>${escape(sequence)}</textarea>
    `
  })}
</section>
    `
  } else {
    return html`
<section id=sequences class=optional>
  <h1>Sequences</h1>
  <p>
    Attach gene sequence files relevant to your finding.
    <a
        href=https://www.ncbi.nlm.nih.gov/genbank/
        target=_blank
      >GenBank</a>
    files are preferred.
    <a
        href=http://zhanglab.ccmb.med.umich.edu/FASTA/
        target=_blank
      >FASTA</a>
    files are also accepted.
  </p>
  <p>
    Please e-mail
    <a
        href=mailto:kyle@publicdomainchronicle.org
        target=_blank
      >Kyle Mitchell</a>
    if you have many sequences to contribute in bulk.
  </p>
  <ul class=inputs>
    ${html`
      <li>
        <input
            name=attachments[]
            type=file
            accept="${escape(SEQUENCE_ACCEPT)}"
        >
      </li>
    `.repeat(3)}
  </ul>
</section>
    `
  }
}
