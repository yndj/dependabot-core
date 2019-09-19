# frozen_string_literal: true

require "dependabot/shared_helpers"
require "rugged"

module Dependabot
  module Clients
    class LocalGit
      class NotFound < StandardError; end

      #######################
      # Constructor methods #
      #######################

      def self.for_source(source:)
        new(source)
      end

      ##########
      # Client #
      ##########

      def initialize(source)
        @source = source
      end

      def fetch_commit(repo, branch)
        branch = git_client(repo).branches[branch]
        branch.target_id
      end

      def fetch_default_branch(repo)
        git_client(repo).branches.each_name(:local).first
      end

      def fetch_repo_contents(repo, commit = nil, path = nil)
        files = git_client(repo).lookup(commit).tree.select do |f|
          f[:name].start_with?(path)
        end
        files.map do |f|
          blob = git_client(repo).lookup(f[:oid])
          type = case f[:type]
            when "blob" then "file"
            when "tree" then "dir"
            else f[:type]
            end

          OpenStruct.new(
            name: f[:name],
            path: File.dirname(f[:name]),
            type: type,
            size: blob.size
          )
        end
      end

      def fetch_file_contents(repo, commit, path)
        file = git_client(repo).lookup(commit).tree.find do |f|
          f["name"] == path
        end
        git_client(repo).lookup(file[:oid]).content
      end

      private

      def git_client(repo)
        @git_client ||= {}
        @git_client[repo] ||= Rugged::Repository.new(repo)
      end

      attr_reader :repo
      attr_reader :source
    end
  end
end
