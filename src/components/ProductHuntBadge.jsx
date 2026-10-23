// "Featured on Product Hunt" badge. Theme follows the surface it sits on.
const POST_ID = '1290769'
const HREF = 'https://www.producthunt.com/products/naakaalert?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-naakaalert'

export default function ProductHuntBadge({ theme = 'dark', className = '' }) {
  return (
    <a href={HREF} target="_blank" rel="noopener noreferrer" className={`inline-block ${className}`}>
      <img
        alt="NaakaAlert - Live naaka alerts from fellow commuters, with safe energy | Product Hunt"
        width="250"
        height="54"
        loading="lazy"
        src={`https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=${POST_ID}&theme=${theme}&t=1792792255648`}
      />
    </a>
  )
}
