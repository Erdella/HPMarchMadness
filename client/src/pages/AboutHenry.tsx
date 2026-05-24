/**
 * About Henry — the memorial page.
 *
 * Public route (no auth) so the link can be shared freely. Reproduces the
 * Kurt Streeter LA Times piece from April 17, 2009 — the same article that
 * lived on the previous site.
 *
 * Photo handling: drop images into `client/public/about-henry/` and reference
 * them as `/about-henry/<filename>` so Vite serves them as static assets.
 */

export function AboutHenry() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-gold-400">
          In memory of
        </span>
        <h1 className="font-display text-4xl tracking-wider text-gold-400">
          Henry Pearson
        </h1>
        <p className="text-sm text-paper-dim">
          The story behind HP March Madness.
        </p>
      </header>

      <figure className="flex flex-col gap-2">
        <img
          src="/about-henry/henry-and-friends.jpg"
          alt="Henry Pearson with friends."
          className="w-full rounded-sm border border-ink-700 object-cover"
          loading="lazy"
        />
        <figcaption className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
          Henry (center) with friends.
        </figcaption>
      </figure>

      <section className="flex flex-col gap-5 border-t border-ink-700 pt-6">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-faint">
            Los Angeles Times
          </span>
          <h2 className="font-display text-2xl tracking-wide text-paper">
            Henry Pearson may have left early, &lsquo;but he completed nine innings&rsquo;
          </h2>
          <p className="text-sm italic text-paper-dim">
            Family and friends celebrate the life of Henry Pearson, who was killed
            in the accident that also took the life of Angels&rsquo; pitcher Nick
            Adenhart and Fullerton State cheerleader Courtney Stewart.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-paper-faint">
            <a
              href="https://www.latimes.com/archives/la-xpm-2009-apr-17-sp-streeter-adenhart17-story.html"
              target="_blank"
              rel="noreferrer"
              className="hover:text-gold-400"
            >
              April 17, 2009
            </a>{' '}
            · Kurt Streeter
          </p>
        </div>

        <div className="flex flex-col gap-4 leading-relaxed text-paper">
          <p>
            Jaw tight, eyes wet and firm and full of courage, Areta Pearson strode
            toward the field where her late son had spent so many of his youthful
            afternoons.
          </p>
          <p>
            She gripped a baseball tightly. She rocked back and leaned forward and
            flung it. This first pitch, a strike, was the symbolic start of a hard
            and heartfelt memorial Thursday; a celebration of the life of Areta
            and Nigel Pearson&rsquo;s only son, Henry.
          </p>
          <p>
            Henry Pearson died last week, too young, too soon, at 25. It happened
            in the horrifying car accident that claimed two of his friends &mdash;
            Angels pitcher Nick Adenhart and Cal State Fullerton student Courtney
            Stewart &mdash; while leaving his former high school teammate, Jon
            Wilhite, 24, struggling for life in an Orange County hospital.
          </p>
          <p>
            On Wednesday, a memorial was held for Stewart, 20, in Fullerton. On
            Thursday, in Williamsport, Md., a private service was held for
            Adenhart, several Angels attending.
          </p>
          <p>
            At about the same time Adenhart, 22, was memorialized, a Manhattan
            Beach tribute honoring Pearson&rsquo;s energy, charm and unyielding
            love for baseball was underway. About 500 people surrounded the Mira
            Costa High baseball diamond to share the story of his life.
          </p>
          <p>
            Since Pearson was a true son of Manhattan Beach, raised there from the
            time he was a young boy, this was a perfect day. The air was warm and
            fresh. Sea gulls arced over the high school&rsquo;s little green
            stadium, its bleacher seats stuffed with people wearing Dodgers,
            Angels or Mets caps, the teams Henry Pearson rooted for.
          </p>
          <p>
            Areta Pearson&rsquo;s pitch began the day, a celebration broken up
            into 9 innings &mdash; complete with a national anthem, a
            seventh-inning stretch, peanuts donated by the Dodgers, and one of
            Pearson&rsquo;s best friends, Steve Hershey, acting as master of
            ceremonies and mimicking the voice of Vin Scully.
          </p>
          <p>
            &ldquo;It was one thing to be introduced to Henry,&rdquo; Hershey told
            me, just before the matter began. &ldquo;It was another thing to be
            introduced by Henry. He had a way of pumping you up, a way of making
            you feel like you were special. . . A way of making you feel what you
            did in life was just so important to him.&rdquo;
          </p>
          <p>
            Added Nigel Pearson, Henry&rsquo;s father, to the crowd:
            &ldquo;It&rsquo;s difficult to see everyone here today and not see
            Henry here too, making sure that everyone knew one another.&rdquo;
          </p>
          <p>
            Henry Pearson, it became clear to an outsider like me, was the type
            who reveled in other people&rsquo;s success. He had many goals in
            life. As a profession, he hoped to be a sports agent. But his greatest
            goal seemed wrapped up in being a great friend.
          </p>
          <p>
            This, I was told, was how he ended up with Nick Adenhart on that
            fateful night. The two had met in Arizona, when Pearson was a student
            at Arizona State and Adenhart was rehabilitating from an injury. They
            grew close, and even though they weren&rsquo;t best friends, Pearson
            made sure he was there at Angels Stadium on April 8, when Adenhart
            pitched the best game of his fledgling career.
          </p>
          <p>
            &ldquo;Of course my brother had to be there, in the stands, to support
            Nick,&rdquo; said his sister, Jessica. &ldquo;It makes perfect
            sense.&rdquo;
          </p>
          <p>
            When the accident happened &mdash; a crash caused by an alleged drunk
            driver now charged with three counts of murder &mdash; Pearson and his
            pals were headed to a night club to do country music line dancing,
            which also made perfect sense. Henry Pearson, after all, was something
            of a bon vivant; a guy who loved to dance and sing and even rap. A guy
            who, whenever he attended a party, managed to make the occasion
            happier, livelier and lighter.
          </p>
          <p>
            All during Thursday&rsquo;s memorial, stories were dished about his
            moxie and pluck. How he&rsquo;d been, from the time he was a toddler,
            infatuated with sports: mostly with baseball and mostly with the Mets,
            since he was born in New Jersey. How he used his knowledge of sports
            trivia, even as a first-grader, to converse with adults.
          </p>
          <p>
            How he loved to talk trash on the baseball field at Mira Costa High,
            where he was a second baseman with medium skills but major guts. There
            were memories of college days at Arizona State, memories of his two
            years at Western State Law School in Fullerton. Memories of
            girlfriends and the prom and volleyball on Manhattan Beach, games
            he&rsquo;d sometimes play in a baseball uniform.
          </p>
          <p>
            I was never lucky enough to meet Pearson, but it was an honor to be
            there Thursday. You could sense his spirit in the dignified way his
            parents and sister moved and spoke, in the warm embraces and memories,
            in the laughter and the tears. It felt as if his story should be told,
            as if we&rsquo;d be well to know about him.
          </p>
        </div>

        <blockquote className="border-l-2 border-gold-400 pl-4 text-paper">
          <p className="leading-relaxed">
            Said Hershey, wearing a Phillies cap, bringing the ceremony to a
            close: Henry Pearson loved baseball &ldquo;because the clock
            didn&rsquo;t determine the outcome. It was an event. He would say:
            &lsquo;You gotta play nine innings, it&rsquo;s never over. There&rsquo;s
            gotta be something that completes the game.&rsquo; I don&rsquo;t think
            that can be any more appropriate. . . . Henry may have left us early,
            but he completed nine innings. He touched us all, and the best legacy,
            the best thing we can do, is to live our lives in the way he lived
            his.&rdquo;
          </p>
        </blockquote>

        <footer className="flex flex-col gap-1 border-t border-ink-700 pt-4 font-mono text-[10px] uppercase tracking-widest text-paper-faint">
          <span>Kurt Streeter · Los Angeles Times</span>
          <a
            href="mailto:kurt.streeter@latimes.com"
            className="lowercase tracking-normal text-gold-400 hover:underline"
          >
            kurt.streeter@latimes.com
          </a>
        </footer>
      </section>
    </article>
  );
}
