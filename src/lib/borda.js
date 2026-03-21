// Borda count: voter's top pick gets N points, 2nd gets N-1, etc.
export function computeScores(votes, options) {
  const scores = {}, counts = {}
  options.forEach(o => { scores[o.id] = 0; counts[o.id] = 0 })
  votes.forEach(v =>
    v.ranking.forEach((id, i) => {
      if (id in scores) {
        scores[id] += v.ranking.length - i
        counts[id]++
      }
    })
  )
  return { scores, counts }
}
