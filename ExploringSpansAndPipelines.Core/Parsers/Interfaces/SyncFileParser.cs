using ExploringSpansAndIOPipelines.Core.Interfaces;
using ExploringSpansAndIOPipelines.Core.Models;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace ExploringSpansAndIOPipelines.Core.Parsers.Interfaces
{
    public class SyncFileParser : IFileParser
    {
        private readonly ILineParser _lineParser;

        public SyncFileParser(ILineParser lineParser)
        {
            _lineParser = lineParser;
        }

        public async Task<List<Videogame>> Parse(string file)
        {
            var videoGames = new List<Videogame>();
            using (StreamReader reader = new StreamReader(file))
            {
                string line = reader.ReadLine();
                while(!string.IsNullOrEmpty(line))
                {
                    var vg = _lineParser.Parse(line);
                    videoGames.Add(vg);
                    line = reader.ReadLine();
                }
            }
            return videoGames;
        }
    }
}
