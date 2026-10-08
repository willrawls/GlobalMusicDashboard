import { ExternalLink } from "lucide-react";

const groups = [
  {
    title: "Follow the data",
    description:
      "Explore the catalog and source communities behind this snapshot.",
    links: [
      {
        title: "Kaggle datasets",
        url: "https://www.kaggle.com/datasets",
        label: "Dataset catalog",
        description:
          "Browse music datasets, notebooks, and community analyses. This snapshot is credited to Kaggle; its exact dataset listing was not supplied.",
      },
      {
        title: "MusicBrainz",
        url: "https://musicbrainz.org/",
        label: "Artist & release metadata",
        description:
          "Look up artists, release editions, identifiers, and relationships in the community-maintained music encyclopedia used by this snapshot.",
      },
      {
        title: "Pageviews Analysis",
        url: "https://pageviews.wmcloud.org/",
        label: "Wikipedia attention",
        description:
          "Compare Wikipedia article views over time. Explore other dates and pages alongside the fixed attention window captured here.",
      },
    ],
  },
  {
    title: "Understand the measures",
    description:
      "Learn what the numbers and community labels actually represent.",
    links: [
      {
        title: "What counts as a pageview?",
        url: "https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/concepts/page-views.html",
        label: "Wikimedia documentation",
        description:
          "Read how Wikimedia defines pageviews and distinguishes automated traffic. Article attention is different from music listening, sales, or unique people.",
      },
      {
        title: "How MusicBrainz tags work",
        url: "https://musicbrainz.org/doc/Folksonomy_Tagging",
        label: "Community tagging",
        description:
          "See how contributors apply and vote on labels. Tags can describe genres, professions, places, or opinions; they are not an exclusive genre taxonomy.",
      },
    ],
  },
  {
    title: "Connect the wider picture",
    description: "Find related knowledge and understand source reuse.",
    links: [
      {
        title: "Wikidata",
        url: "https://www.wikidata.org/wiki/Wikidata:Main_Page",
        label: "Related knowledge project",
        description:
          "Explore structured information and identifiers connecting artists, places, and other reference sources. Wikidata is a related resource, not a source imported into this dashboard.",
      },
      {
        title: "MusicBrainz data licenses",
        url: "https://musicbrainz.org/doc/About/Data_License",
        label: "Attribution & reuse",
        description:
          "Check the distinction between core and supplementary MusicBrainz data before reuse. These upstream terms do not establish a license for the combined Kaggle snapshot.",
      },
    ],
  },
];

export default function Explore() {
  return (
    <div className="explore-page">
      <p className="hint">
        External links open in a new tab. These sites may show newer information
        than this dashboard’s fixed snapshot.
      </p>
      {groups.map((group) => (
        <section
          className="explore-section"
          key={group.title}
          aria-label={group.title}
        >
          <h2>{group.title}</h2>
          <p>{group.description}</p>
          <div className="explore-grid">
            {group.links.map((link) => (
              <a
                className="explore-card"
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="eyebrow">{link.label}</span>
                <h3>
                  {link.title}
                  <ExternalLink size={17} aria-hidden="true" />
                </h3>
                <p>{link.description}</p>
                <span className="explore-domain">
                  {new URL(link.url).hostname}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
      <div className="note">
        For the exact files, source hashes, coverage gaps, and calculations used
        here, visit <a href="/methodology">Data & methodology</a>. External
        sources do not automatically update this snapshot.
      </div>
    </div>
  );
}
