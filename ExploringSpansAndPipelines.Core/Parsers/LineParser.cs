using System;
using System.Globalization;
using ExploringSpansAndIOPipelines.Core.Interfaces;
using ExploringSpansAndIOPipelines.Core.Models;

namespace ExploringSpansAndIOPipelines.Core.Parsers
{
    public class LineParser : ILineParser
    {
        public Videogame Parse(string line)
        {
            var parts = line.Split('|');

            return new Videogame
            {
                Id = Guid.Parse(parts[0]),
                Name = parts[1],
                Genre = Enum.Parse<Genres>(parts[2]),
                ReleaseDate = DateTime.ParseExact(
                    parts[3],
                    "yyyy-MM-dd",
                    DateTimeFormatInfo.InvariantInfo,
                    DateTimeStyles.None),
                Rating = double.Parse(parts[4]),
                HasMultiplayer = bool.Parse(parts[5])
            };
        }
    }
}